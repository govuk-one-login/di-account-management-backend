import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { Context } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { getEnvironmentVariable } from "./common/utils.js";
import { DynamoDBClient, DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import { MetricUnit } from "@aws-lambda-powertools/metrics";
import { initMetrics } from "./common/metrics.js";
import { countAccountsForDate } from "./common/query-inactive-accounts.js";
import checkIfDateIs27October from "./common/check-if-date-is-27-october.js";
import iadQueryLogicHash from "./common/iad-query-logic-hash.json" with { type: "json" };
const metrics = initMetrics("inactive-account-deletion-forecast");

const logger = new Logger();
const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(dynamoClient);

const FORECAST_DAYS = 5 * 365;
const SKIP_EMAIL_REASON_BREAKDOWN_DAYS = 90;
const TTL_SECONDS = 365 * 24 * 60 * 60;
const BATCH_SIZE = 20;
const REMAINING_TIME_THRESHOLD_MS = 10_000;

export const buildDates = (fromDate: Date, days: number): string[] =>
  Array.from({ length: days }, (_, i) => {
    const d = new Date(fromDate);
    d.setDate(d.getDate() + i + 1);
    return d.toISOString().split("T")[0];
  });

const chunk = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, i * size + size)
  );

const publishRecordCountMetric = async (tableName: string): Promise<void> => {
  try {
    const describeCommand = new DescribeTableCommand({ TableName: tableName });
    const tableInfo = await dynamoClient.send(describeCommand);
    const itemCount = tableInfo.Table?.ItemCount ?? 0;

    metrics.addMetric(
      "InactiveAccountTrackerRecordCount",
      MetricUnit.Count,
      itemCount
    );
    metrics.publishStoredMetrics();
  } catch (metricError) {
    logger.error(
      "Failed to retrieve and/or publish InactiveAccountTrackerRecordCount metric",
      { error: metricError }
    );
  }
};

export const handler = async (
  _event: unknown,
  context: Context
): Promise<void> => {
  logger.addContext(context);
  logger.info("IAD query logic hash", {
    iadQueryLogicHash: iadQueryLogicHash.hash,
  });

  const tableName = getEnvironmentVariable("TABLE_NAME");
  const forecastTableName = getEnvironmentVariable("FORECAST_TABLE_NAME");
  const dates = buildDates(new Date(), FORECAST_DAYS);
  const forecastedAt = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const breakdownCutoffDate = new Date();
  breakdownCutoffDate.setDate(
    breakdownCutoffDate.getDate() + SKIP_EMAIL_REASON_BREAKDOWN_DAYS
  );

  await publishRecordCountMetric(tableName);

  let processed = 0;

  for (const batch of chunk(dates, BATCH_SIZE)) {
    const results = await Promise.all(
      batch.map((date) => {
        const parsedDate = new Date(date);
        return countAccountsForDate(tableName, date, {
          includeSkipEmailReasonBreakdown: parsedDate <= breakdownCutoffDate,
        });
      })
    );

    await Promise.all(
      batch.map((date, i) => {
        const { total, emailForecast } = results[i];
        const is27October = checkIfDateIs27October(date);

        const logData: Record<string, unknown> = {
          dateForDeletion: date,
          accountsToDelete: total,
          ...(is27October && { skippedVerifyMigrated: total }),
          ...(!is27October && emailForecast && { ...emailForecast }),
        };

        logger.info("Deletion forecast", logData);
        return dynamoDocClient.send(
          new PutCommand({
            TableName: forecastTableName,
            Item: {
              dateForDeletion: date,
              forecastedAt,
              accountsToDelete: total,
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
