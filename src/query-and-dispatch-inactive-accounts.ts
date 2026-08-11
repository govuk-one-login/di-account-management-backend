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

export async function* queryAccountsByDate(
  tableName: string,
  dateForDeletion: string
): AsyncGenerator<InactiveAccountTrackerRecord[]> {
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

    if (response.Items?.length) {
      yield response.Items as InactiveAccountTrackerRecord[];
    }
    lastEvaluatedKey = response.LastEvaluatedKey ?? undefined;
  } while (lastEvaluatedKey);
}

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
      const eligible = page.filter((record) => allowedStatuses.includes(record.status));

      for (const record of eligible) {
        try {
          await sqsClient.send(
            new SendMessageCommand({
              QueueUrl: queueUrl,
              MessageBody: JSON.stringify({ ...record, processName: event.processName }),
            })
          );
          dispatched++;
        } catch (err) {
          logger.error(`Failed to dispatch account ${record.commonSubjectId}`, { err });
        }
      }
    }
  }

  logger.info(`Dispatched ${dispatched} accounts to ${event.processName}`);
};
