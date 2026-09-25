import { Context } from "aws-lambda";
import { SQSClient, SendMessageBatchCommand } from "@aws-sdk/client-sqs";
import { Logger } from "@aws-lambda-powertools/logger";
import { getEnvironmentVariable } from "./common/utils.js";
import { processConfig } from "./common/process-config.js";
import {
  countAccountsForDate,
  queryAccountsByDate,
} from "./common/query-inactive-accounts.js";
import { retryFunction } from "./common/retry-function.js";
import type { InactiveAccountTrackerRecord } from "./common/model.js";
import iadQueryLogicHash from "./common/iad-query-logic-hash.json" with { type: "json" };
import {
  disableIad,
  getIadCircuitBreakerStatus,
} from "./common/iad-circuit-breaker.js";
import { getLatestForecastItemForDate } from "./common/iadGetLatestForecastItemForDate.js";

const logger = new Logger();

const SQS_BATCH_SIZE = 10;
const MAX_CONCURRENT_BATCHES = 20;
const sqsClient = new SQSClient({ maxAttempts: 5 });

export interface QueryAndDispatchEvent {
  processName: string;
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

const logAbort = (
  guardrailType: string,
  processName: string,
  targetDate: string,
  dispatchedBeforeAbort: number,
  isDryRun: boolean,
  otherProps?: object
): void => {
  logger.info("GuardrailAbortedQueryAndDispatchInactiveAccounts", {
    guardrailType,
    contributeToAlarm: "1",
    continueProcessingRecords: "0",
    isDryRun: isDryRun ? "1" : "0",
    processName,
    targetDate,
    dispatchedBeforeAbort,
    ...otherProps,
  });
};

const filterEligible = (
  page: InactiveAccountTrackerRecord[],
  allowedStatuses: string[]
): InactiveAccountTrackerRecord[] =>
  page.filter((record) => allowedStatuses.includes(record.status));

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
  processName: string,
  isDryRun: boolean
): Promise<number> => {
  try {
    const result = await retryFunction(
      () =>
        sqsClient.send(
          new SendMessageBatchCommand({
            QueueUrl: queueUrl,
            Entries: chunk.map((record, i) => ({
              Id: String(i),
              MessageBody: JSON.stringify({ ...record, processName, isDryRun }),
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
  processName: string,
  isDryRun: boolean
): Promise<number> => {
  const chunks = chunkRecords(eligible);
  let dispatched = 0;

  for (let i = 0; i < chunks.length; i += MAX_CONCURRENT_BATCHES) {
    const wave = chunks.slice(i, i + MAX_CONCURRENT_BATCHES);
    const results = await Promise.all(
      wave.map((chunk) => sendChunk(chunk, queueUrl, processName, isDryRun))
    );
    dispatched += results.reduce((sum, n) => sum + n, 0);
  }

  return dispatched;
};

const forecastQueryLogicHashMatches = async (
  processName: string,
  targetDate: string,
  dispatched: number,
  isDryRun: boolean
): Promise<boolean> => {
  if (processName !== "DeleteAccount") return true;
  const forecastItem = await getLatestForecastItemForDate(targetDate);
  const storedHash = forecastItem?.iadQueryLogicHash as
    { hash: string; algorithm: string } | undefined;
  if (
    storedHash?.hash === iadQueryLogicHash.hash &&
    storedHash?.algorithm === iadQueryLogicHash.algorithm
  ) {
    return true;
  }
  await disableIad({
    guardrailType: "ForecastQueryLogicHashMismatch",
    processName,
    targetDate,
    dispatchedBeforeAbort: dispatched,
    forecastHash: storedHash,
    actualHash: iadQueryLogicHash,
    isDryRun,
  });
  logAbort(
    "ForecastQueryLogicHashMismatch",
    processName,
    targetDate,
    dispatched,
    isDryRun,
    {
      forecastHash: storedHash,
      actualHash: iadQueryLogicHash,
    }
  );
  return false;
};

const forecastNumberOfDeletionsAlignsWithReality = async (
  processName: string,
  targetDate: string,
  tableName: string,
  dispatched: number,
  isDryRun: boolean
): Promise<boolean> => {
  if (processName !== "DeleteAccount") return true;
  const forecastedCount = (await getLatestForecastItemForDate(targetDate))
    ?.accountsToDelete;
  const { total: actualCount } = await countAccountsForDate(
    tableName,
    targetDate
  );
  if (forecastedCount !== undefined && forecastedCount >= actualCount)
    return true;
  await disableIad({
    guardrailType: "HomeToDeleteMoreThanForecast",
    processName,
    targetDate,
    dispatchedBeforeAbort: dispatched,
    forecastedCount,
    actualCount,
    isDryRun,
  });
  logAbort(
    "HomeToDeleteMoreThanForecast",
    processName,
    targetDate,
    dispatched,
    isDryRun,
    {
      forecastedCount,
      actualCount,
    }
  );
  return false;
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

  const {
    queueUrlEnvVar,
    daysToDeletion,
    allowedStatuses,
    isDryRun = false,
  } = processConfig[event.processName];
  const queueUrl = getEnvironmentVariable(queueUrlEnvVar);

  let dispatched = 0;

  for (const days of daysToDeletion) {
    const targetDate = calculateTargetDate(days);

    if (
      !(await forecastQueryLogicHashMatches(
        event.processName,
        targetDate,
        dispatched,
        isDryRun
      ))
    ) {
      return;
    }

    if (
      !(await forecastNumberOfDeletionsAlignsWithReality(
        event.processName,
        targetDate,
        tableName,
        dispatched,
        isDryRun
      ))
    ) {
      return;
    }

    logger.info(`Querying accounts for deletion date: ${targetDate}`);

    let eligibleForDate = 0;

    for await (const page of queryAccountsByDate(tableName, targetDate)) {
      if (await getIadCircuitBreakerStatus()) {
        logAbort(
          "CircuitBreakerAlreadyTripped",
          event.processName,
          targetDate,
          dispatched,
          isDryRun
        );
        return;
      }

      const eligible = filterEligible(page, allowedStatuses);
      eligibleForDate += eligible.length;

      if (!isDryRun) {
        dispatched += await dispatchEligibleRecords(
          eligible,
          queueUrl,
          event.processName,
          isDryRun
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
