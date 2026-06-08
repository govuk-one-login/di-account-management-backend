import { Logger } from "@aws-lambda-powertools/logger";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { Context } from "aws-lambda";
import { scanSegment } from "./scan-segment.js";
import { ageThresholdsFromNow, CounterIndex } from "./age-thresholds.js";
import {
  computePercentiles,
  computeConcentration,
  PercentileResult,
  ConcentrationResult,
} from "./compute-report.js";
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
  items_per_user_distribution: PercentileResult;
  concentration: ConcentrationResult;
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

  const scanDurationSeconds = Math.round((Date.now() - startTime) / 1000);

  logger.info("Compiling report");

  const allCounters = results.flatMap((r) => r.perUserCounters);

  if (allCounters.length === 0) {
    throw new Error("Scan returned no items");
  }

  const totalCounts = new Array(allCounters.length);
  let totalItems = 0;
  for (let i = 0; i < allCounters.length; i++) {
    const count = allCounters[i][CounterIndex.TOTAL];
    totalCounts[i] = count;
    totalItems += count;
  }

  totalCounts.sort((a, b) => a - b);
  const items_per_user_distribution = computePercentiles(totalCounts);

  totalCounts.reverse();
  const concentration = computeConcentration(totalCounts, totalItems);

  const report: ScanReport = {
    total_items: totalItems,
    total_users: allCounters.length,
    scan_duration_seconds: scanDurationSeconds,
    items_per_user_distribution,
    concentration,
  };

  logger.info("Report complete", { ...report });

  return report;
};
