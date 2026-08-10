import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { Logger } from "@aws-lambda-powertools/logger";
import { getEnvironmentVariable } from "./common/utils.js";

const logger = new Logger();
const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(dynamoClient);

const FORECAST_DAYS = 180;
const TTL_SECONDS = 365 * 24 * 60 * 60;

export const buildDates = (fromDate: Date, days: number): string[] =>
  Array.from({ length: days }, (_, i) => {
    const d = new Date(fromDate);
    d.setDate(d.getDate() + i + 1);
    return d.toISOString().split("T")[0];
  });

export const countAccountsForDate = async (
  tableName: string,
  dateForDeletion: string
): Promise<number> => {
  let count = 0;
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const response = await dynamoDocClient.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "dateForDeletion = :date",
        ExpressionAttributeValues: { ":date": dateForDeletion },
        Select: "COUNT",
        ConsistentRead: false,
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );
    count += response.Count ?? 0;
    lastEvaluatedKey = response.LastEvaluatedKey ?? undefined;
  } while (lastEvaluatedKey);

  return count;
};

export const handler = async (): Promise<void> => {
  const tableName = getEnvironmentVariable("TABLE_NAME");
  const forecastTableName = getEnvironmentVariable("FORECAST_TABLE_NAME");
  const dates = buildDates(new Date(), FORECAST_DAYS);
  const forecastedAt = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + TTL_SECONDS;

  const counts = await Promise.all(
    dates.map((date) => countAccountsForDate(tableName, date))
  );

  await Promise.all(
    dates.map((date, i) =>
      dynamoDocClient.send(
        new PutCommand({
          TableName: forecastTableName,
          Item: {
            dateForDeletion: date,
            forecastedAt,
            accountsToDelete: counts[i],
            ttl,
          },
        })
      )
    )
  );

  logger.info(`Saved deletion forecast for ${dates.length} dates`);
};
