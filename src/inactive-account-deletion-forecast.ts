import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { Logger } from "@aws-lambda-powertools/logger";
import { MetricUnit } from "@aws-lambda-powertools/metrics";
import { initMetrics } from "./common/metrics.js";
import { getEnvironmentVariable } from "./common/utils.js";

const logger = new Logger();
const metrics = initMetrics("inactive-account-deletion-forecast");
const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(dynamoClient);

const FORECAST_DAYS = 180;
const METRIC_NAME = "InactiveAccountsScheduledForDeletion";

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
  const dates = buildDates(new Date(), FORECAST_DAYS);

  const counts = await Promise.all(
    dates.map((date) => countAccountsForDate(tableName, date))
  );

  dates.forEach((date, i) => {
    const singleMetric = metrics.singleMetric();
    singleMetric.addDimension("DateForDeletion", date);
    singleMetric.addMetric(METRIC_NAME, MetricUnit.Count, counts[i]);
  });

  logger.info(`Published deletion forecast for ${dates.length} dates`);
};
