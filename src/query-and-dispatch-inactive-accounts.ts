import { Context } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { Logger } from "@aws-lambda-powertools/logger";
import { getEnvironmentVariable } from "./common/utils.js";
import type { InactiveAccountTrackerRecord } from "./common/model.js";
import { processConfig } from "./common/process-config.js";

const logger = new Logger();
const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(dynamoClient);
const sqsClient = new SQSClient({});

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

export const queryAccountsByDate = async (
  tableName: string,
  dateForDeletion: string
): Promise<InactiveAccountTrackerRecord[]> => {
  const results: InactiveAccountTrackerRecord[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const response = await dynamoDocClient.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "dateForDeletion = :date",
        ExpressionAttributeValues: { ":date": dateForDeletion },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    if (response.Items) {
      results.push(...(response.Items as InactiveAccountTrackerRecord[]));
    }
    lastEvaluatedKey = response.LastEvaluatedKey ?? undefined;
  } while (lastEvaluatedKey);

  return results;
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

  const records: InactiveAccountTrackerRecord[] = [];
  for (const days of daysToDeletion) {
    const targetDate = calculateTargetDate(days);
    logger.info(`Querying accounts for deletion date: ${targetDate}`);
    const result = await queryAccountsByDate(tableName, targetDate);
    records.push(...result);
  }

  const eligibleRecords = records.filter((record) => allowedStatuses.includes(record.status));

  if (eligibleRecords.length === 0) {
    logger.info("No eligible accounts found for target dates");
    return;
  }

  for (const record of eligibleRecords) {
    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify({ ...record, processName: event.processName }),
      })
    );
  }

  logger.info(`Dispatched ${eligibleRecords.length} accounts to ${event.processName}`);
};
