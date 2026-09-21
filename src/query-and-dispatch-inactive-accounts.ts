import { Context } from "aws-lambda";
import { SQSClient, SendMessageBatchCommand } from "@aws-sdk/client-sqs";
import { Logger } from "@aws-lambda-powertools/logger";
import { getEnvironmentVariable } from "./common/utils.js";
import { processConfig } from "./common/process-config.js";
import { queryAccountsByDate } from "./common/query-inactive-accounts.js";
import { retryFunction } from "./common/retry-function.js";
import iadQueryLogicHash from "./common/iad-query-logic-hash.json" with { type: "json" };
import { getIadCircuitBreakerStatus } from "./common/iad-circuit-breaker.js";

const logger = new Logger();


const MAX_CONCURRENT_BATCHES = 20;
const sqsClient = new SQSClient({ maxAttempts: 5 });

export interface QueryAndDispatchEvent {
  processName: string;
  manualTestOnly?: boolean;
}

export const calculateTargetDate = (daysToDeletion: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + daysToDeletion);
  return date.toISOString().split("T")[0];
};

export const validateEvent = (event: QueryAndDispatchEvent): void => {
  if (!event.processName || !processConfig[event.processName]) {
    throw new Error(`Unknown processName: ${event.processName}`);
  }
};

export const handler = async (
  event: QueryAndDispatchEvent,
  context: Context
): Promise<void> => {
  logger.addContext(context);
  logger.info("IAD query logic hash", {
    iadQueryLogicHash: iadQueryLogicHash.hash,
  });

  validateEvent(event);

  const tableName = getEnvironmentVariable("TABLE_NAME");

  const { queueUrlEnvVar, daysToDeletion, allowedStatuses, isDryRun } =
    processConfig[event.processName];
  const queueUrl = getEnvironmentVariable(queueUrlEnvVar);

  let dispatched = 0;

  for (const days of daysToDeletion) {
    const targetDate = calculateTargetDate(days);
    logger.info(`Querying accounts for deletion date: ${targetDate}`);

    let eligibleForDate = 0;

    for await (const page of queryAccountsByDate(tableName, targetDate)) {
      const iadCircuitBreakerActive = await getIadCircuitBreakerStatus();

      if (iadCircuitBreakerActive) {
        logger.info("GuardrailAbortedQueryAndDispatchInactiveAccounts", {
          guardrailType: "CircuitBreakerAlreadyTripped",
          contributeToAlarm: "1",
          furtherProcessingAborted: "1",
          processName: event.processName,
          targetDate,
          dispatchedBeforeAbort: dispatched,
        });
        return;
      }

      const eligible = page.filter(
        (record) =>
          allowedStatuses.includes(record.status) &&
          (!event.manualTestOnly ||
            record.userLastActiveSource === "MANUAL_TEST")
      );

      eligibleForDate += eligible.length;

      if (isDryRun) {
        continue;
      }

      const chunks = [];
      for (let i = 0; i < eligible.length; i += 10) {
        chunks.push(eligible.slice(i, i + 10));
      }

      const sendChunk = async (chunk: typeof eligible): Promise<void> => {
        try {
          const result = await retryFunction(
            () =>
              sqsClient.send(
                new SendMessageBatchCommand({
                  QueueUrl: queueUrl,
                  Entries: chunk.map((record, i) => ({
                    Id: String(i),
                    MessageBody: JSON.stringify({ ...record, processName: event.processName }),
                  })),
                })
              ),
            { functionName: "SendMessageBatch" }
          );
          dispatched += chunk.length - (result.Failed?.length ?? 0);
          for (const failure of result.Failed ?? []) {
            logger.error(`Failed to dispatch account in batch`, { failure });
          }
        } catch (err) {
          logger.error(`Failed to send batch`, { err });
        }
      };

      // Dispatch in bounded waves to avoid exhausting the SQS connection pool.
      for (let i = 0; i < chunks.length; i += MAX_CONCURRENT_BATCHES) {
        await Promise.all(
          chunks.slice(i, i + MAX_CONCURRENT_BATCHES).map(sendChunk)
        );
      }
    }

    if (isDryRun) {
      logger.info(
        `Dry Run ${event.processName}: found ${eligibleForDate} accounts for date ${targetDate}`
      );
    }
  }

  logger.info(`Dispatched ${dispatched} accounts to ${event.processName}`);
};
