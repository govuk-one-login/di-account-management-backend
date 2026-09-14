import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { Context } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { getEnvironmentVariable } from "./common/utils.js";
import { DynamoDBClient, DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import { MetricUnit } from "@aws-lambda-powertools/metrics";
import { initMetrics } from "./common/metrics.js";
const metrics = initMetrics("inactive-account-deletion-forecast");

const logger = new Logger();
const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(dynamoClient);

const FORECAST_DAYS = 5 * 365;
const TTL_SECONDS = 365 * 24 * 60 * 60;
const BATCH_SIZE = 20;
const REMAINING_TIME_THRESHOLD_MS = 10_000;

export const buildDates = (fromDate: Date, days: number): string[] =>
  Array.from({ length: days }, (_, i) => {
    const d = new Date(fromDate);
    d.setDate(d.getDate() + i + 1);
    return d.toISOString().split("T")[0];
  });

const chunk = <T,>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, i * size + size)
  );

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

const publishRecordCountMetric = async (tableName: string): Promise<void> => {
  try {
    const describeCommand = new DescribeTableCommand({ TableName: tableName });
    const tableInfo = await dynamoClient.send(describeCommand);
    const itemCount = tableInfo.Table?.ItemCount ?? 0;

    metrics.addMetric("InactiveAccountTrackerRecordCount", MetricUnit.Count, itemCount);
    metrics.publishStoredMetrics();
  } catch (metricError) {
    logger.error("Failed to retrieve and/or publish InactiveAccountTrackerRecordCount metric", { error: metricError });
  }
};

export const handler = async (
  _event: unknown,
  context: Context
): Promise<void> => {
  const tableName = getEnvironmentVariable("TABLE_NAME");
  const forecastTableName = getEnvironmentVariable("FORECAST_TABLE_NAME");
  const dates = buildDates(new Date(), FORECAST_DAYS);
  const forecastedAt = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + TTL_SECONDS;

  await publishRecordCountMetric(tableName);

  let processed = 0;

  for (const batch of chunk(dates, BATCH_SIZE)) {
    const counts = await Promise.all(
      batch.map((date) => countAccountsForDate(tableName, date))
    );

    await Promise.all(
      batch.map((date, i) => {
        logger.info("Deletion forecast", { dateForDeletion: date, accountsToDelete: counts[i] });
        return dynamoDocClient.send(
          new PutCommand({
            TableName: forecastTableName,
            Item: {
              dateForDeletion: date,
              forecastedAt,
              accountsToDelete: counts[i],
              ttl,
            },
          })
        );
      })
    );

    processed += batch.length;

    if (context.getRemainingTimeInMillis() < REMAINING_TIME_THRESHOLD_MS) {
      logger.info(
        `Approaching timeout, stopping. Forecasted ${processed} of ${dates.length} dates.`
      );
      return;
    }
  }

  logger.info(`Saved deletion forecast for ${processed} dates`);
};
