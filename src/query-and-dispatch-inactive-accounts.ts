import { Context } from "aws-lambda";
import { SQSClient, SendMessageBatchCommand } from "@aws-sdk/client-sqs";
import { Logger } from "@aws-lambda-powertools/logger";
import { getEnvironmentVariable } from "./common/utils.js";
import { processConfig } from "./common/process-config.js";
import { queryAccountsByDate } from "./common/query-inactive-accounts.js";
import { retryFunction } from "./common/retry-function.js";
import type { InactiveAccountTrackerRecord } from "./common/model.js";
import iadQueryLogicHash from "./common/iad-query-logic-hash.json" with { type: "json" };
import { getIadCircuitBreakerStatus } from "./common/iad-circuit-breaker.js";

const logger = new Logger();

const SQS_BATCH_SIZE = 10;
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

const logCircuitBreakerAbort = (
  processName: string,
  targetDate: string,
  dispatchedBeforeAbort: number
): void => {
  logger.info("GuardrailAbortedQueryAndDispatchInactiveAccounts", {
    guardrailType: "CircuitBreakerAlreadyTripped",
    contributeToAlarm: "1",
    continueProcessingRecords: "0",
    processName,
    targetDate,
    dispatchedBeforeAbort,
  });
};

const filterEligible = (
  page: InactiveAccountTrackerRecord[],
  allowedStatuses: string[],
  manualTestOnly: boolean
): InactiveAccountTrackerRecord[] =>
  page.filter(
    (record) =>
      allowedStatuses.includes(record.status) &&
      (!manualTestOnly || record.userLastActiveSource === "MANUAL_TEST")
  );

const chunkRecords = (
  records: InactiveAccountTrackerRecord[]
): InactiveAccountTrackerRecord[][] => {
  const chunks: InactiveAccountTrackerRecord[][] = [];
  for (let i = 0; i < records.length; i += SQS_BATCH_SIZE) {
    chunks.push(records.slice(i, i + SQS_BATCH_SIZE));
  }
  return chunks;
};

const sendChunk = async (
  chunk: InactiveAccountTrackerRecord[],
  queueUrl: string,
  processName: string
): Promise<number> => {
  try {
    const result = await retryFunction(
      () =>
        sqsClient.send(
          new SendMessageBatchCommand({
            QueueUrl: queueUrl,
            Entries: chunk.map((record, i) => ({
              Id: String(i),
              MessageBody: JSON.stringify({ ...record, processName }),
            })),
          })
        ),
      { functionName: "SendMessageBatch" }
    );
    for (const failure of result.Failed ?? []) {
      logger.error(`Failed to dispatch account in batch`, { failure });
    }
    return chunk.length - (result.Failed?.length ?? 0);
  } catch (err) {
    logger.error(`Failed to send batch`, { err });
    return 0;
  }
};

const dispatchEligibleRecords = async (
  eligible: InactiveAccountTrackerRecord[],
  queueUrl: string,
  processName: string
): Promise<number> => {
  const chunks = chunkRecords(eligible);
  let dispatched = 0;

  for (let i = 0; i < chunks.length; i += MAX_CONCURRENT_BATCHES) {
    const wave = chunks.slice(i, i + MAX_CONCURRENT_BATCHES);
    const results = await Promise.all(
      wave.map((chunk) => sendChunk(chunk, queueUrl, processName))
    );
    dispatched += results.reduce((sum, n) => sum + n, 0);
  }

  return dispatched;
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
      if (await getIadCircuitBreakerStatus()) {
        logCircuitBreakerAbort(event.processName, targetDate, dispatched);
        return;
      }

      const eligible = filterEligible(
        page,
        allowedStatuses,
        Boolean(event.manualTestOnly)
      );
      eligibleForDate += eligible.length;

      if (!isDryRun) {
        dispatched += await dispatchEligibleRecords(
          eligible,
          queueUrl,
          event.processName
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
