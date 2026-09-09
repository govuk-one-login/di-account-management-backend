import { Context } from "aws-lambda";
import { SQSClient, SendMessageBatchCommand } from "@aws-sdk/client-sqs";
import { Logger } from "@aws-lambda-powertools/logger";
import { getEnvironmentVariable } from "./common/utils.js";
import { processConfig } from "./common/process-config.js";
import { queryAccountsByDate } from "./common/query-inactive-accounts.js";

const logger = new Logger();
const sqsClient = new SQSClient({});

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

  validateEvent(event);

  const tableName = getEnvironmentVariable("TABLE_NAME");

  const { queueUrlEnvVar, daysToDeletion, allowedStatuses } = processConfig[event.processName];
  const queueUrl = getEnvironmentVariable(queueUrlEnvVar);

  let dispatched = 0;

  for (const days of daysToDeletion) {
    const targetDate = calculateTargetDate(days);
    logger.info(`Querying accounts for deletion date: ${targetDate}`);

    for await (const page of queryAccountsByDate(tableName, targetDate)) {
      const eligible = page.filter((record) =>
        allowedStatuses.includes(record.status) &&
        (!event.manualTestOnly || record.userLastActiveSource === "MANUAL_TEST")
      );

      const chunks = [];
      for (let i = 0; i < eligible.length; i += 10) {
        chunks.push(eligible.slice(i, i + 10));
      }

      await Promise.all(
        chunks.map(async (chunk) => {
          try {
            const result = await sqsClient.send(
              new SendMessageBatchCommand({
                QueueUrl: queueUrl,
                Entries: chunk.map((record, i) => ({
                  Id: String(i),
                  MessageBody: JSON.stringify({ ...record, processName: event.processName }),
                })),
              })
            );
            dispatched += chunk.length - (result.Failed?.length ?? 0);
            for (const failure of result.Failed ?? []) {
              logger.error(`Failed to dispatch account in batch`, { failure });
            }
          } catch (err) {
            logger.error(`Failed to send batch`, { err });
          }
        })
      );
    }
  }

  logger.info(`Dispatched ${dispatched} accounts to ${event.processName}`);
};
