import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import {
  CloudWatchClient,
  PutMetricDataCommand,
  type MetricDatum,
} from "@aws-sdk/client-cloudwatch";
import { Logger } from "@aws-lambda-powertools/logger";
import { getEnvironmentVariable } from "./common/utils.js";

const logger = new Logger();
const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(dynamoClient);
const cloudWatchClient = new CloudWatchClient({});

const FORECAST_DAYS = 180;
const CW_BATCH_SIZE = 20;
const METRIC_NAMESPACE = "account-management-backend";
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

export const publishMetrics = async (
  metrics: MetricDatum[]
): Promise<void> => {
  for (let i = 0; i < metrics.length; i += CW_BATCH_SIZE) {
    await cloudWatchClient.send(
      new PutMetricDataCommand({
        Namespace: METRIC_NAMESPACE,
        MetricData: metrics.slice(i, i + CW_BATCH_SIZE),
      })
    );
  }
};

export const handler = async (): Promise<void> => {
  const tableName = getEnvironmentVariable("TABLE_NAME");
  const dates = buildDates(new Date(), FORECAST_DAYS);

  const counts = await Promise.all(
    dates.map((date) => countAccountsForDate(tableName, date))
  );

  const metrics: MetricDatum[] = dates.map((date, i) => ({
    MetricName: METRIC_NAME,
    Dimensions: [{ Name: "DateForDeletion", Value: date }],
    Value: counts[i],
    Unit: "Count",
  }));

  await publishMetrics(metrics);

  logger.info(`Published deletion forecast for ${dates.length} dates`);
};
