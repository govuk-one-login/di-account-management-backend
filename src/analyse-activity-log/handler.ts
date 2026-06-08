import { Logger } from "@aws-lambda-powertools/logger";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { Context } from "aws-lambda";
import { scanSegment } from "./scan-segment.js";
import { ageThresholdsFromNow, CounterIndex } from "./age-thresholds.js";
import { getEnvironmentVariable } from "../common/utils.js";

const logger = new Logger({ serviceName: "analyse-activity-log" });
const client = new DynamoDBClient({});

export interface AnalyseActivityLogEvent {
  totalSegments: number;
}

export interface ScanReport {
  total_items: number;
  total_users: number;
  scan_duration_seconds: number;
}

export const handler = async (
  event: AnalyseActivityLogEvent,
  context: Context
): Promise<ScanReport> => {
  logger.addContext(context);

  if (
    !event.totalSegments ||
    !Number.isInteger(event.totalSegments) ||
    event.totalSegments < 1
  ) {
    throw new Error("totalSegments must be a positive integer");
  }

  logger.info("Analysis started", { totalSegments: event.totalSegments });

  const startTime = Date.now();
  const ageThresholds = ageThresholdsFromNow(Math.floor(startTime / 1000));
  const tableName = getEnvironmentVariable("TABLE_NAME");

  const segments = [...new Array(event.totalSegments).keys()];
  const results = await Promise.all(
    segments.map((segment) =>
      scanSegment(
        client,
        tableName,
        segment,
        event.totalSegments,
        ageThresholds
      )
    )
  );

  const totalUsers = results.reduce(
    (sum, r) => sum + r.perUserCounters.length,
    0
  );
  const totalItems = results.reduce(
    (sum, r) =>
      sum + r.perUserCounters.reduce((s, t) => s + t[CounterIndex.TOTAL], 0),
    0
  );
  const scanDurationSeconds = Math.round((Date.now() - startTime) / 1000);

  logger.info("Compiling report");

  const summary: ScanReport = {
    total_items: totalItems,
    total_users: totalUsers,
    scan_duration_seconds: scanDurationSeconds,
  };

  logger.info("Scan complete", { ...summary });

  return summary;
};
