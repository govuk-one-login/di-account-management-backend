import { Logger } from "@aws-lambda-powertools/logger";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  LambdaClient,
  InvokeCommand,
  InvocationType,
} from "@aws-sdk/client-lambda";
import { Context } from "aws-lambda";
import { scanSegment, SegmentCursor } from "./scan-segment.js";
import {
  AgeThresholds,
  ageThresholdsFromNow,
  CounterIndex,
} from "./age-thresholds.js";
import {
  computePercentiles,
  computeConcentration,
  computeUserBuckets,
  computeItemsByAgeBucket,
  computeTtlSimulation,
  AGE_BUCKET_LABELS,
  PercentileResult,
  ConcentrationResult,
  UserBucket,
  TtlSimulationResult,
} from "./compute-report.js";
import { getEnvironmentVariable, zeroedArray } from "../common/utils.js";

const SCAN_BUDGET_MS = 13 * 60 * 1000;
const MAX_INVOCATIONS = 20;

const logger = new Logger({ serviceName: "analyse-activity-log" });
const client = new DynamoDBClient({});
const lambdaClient = new LambdaClient({});

export interface AnalyseActivityLogEvent {
  totalSegments: number;
  scanBudgetMs?: number;
  maxInvocations?: number;
  cursors?: (SegmentCursor | null)[];
  invocation?: number;
  ageThresholds?: AgeThresholds;
  scanStartedAt?: string;
}

export interface ScanReport {
  scan_date: string;
  total_items: number;
  total_users: number;
  scan_duration_seconds: number;
  scan_complete: boolean;
  items_per_user_distribution: PercentileResult;
  concentration: ConcentrationResult;
  items_per_user_buckets: Record<string, UserBucket>;
  items_by_age_bucket: Record<string, { count: number }>;
  ttl_impact_simulation: Record<string, TtlSimulationResult>;
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

  const invocation = event.invocation ?? 1;
  const maxInvocations = Math.min(
    event.maxInvocations ?? MAX_INVOCATIONS,
    MAX_INVOCATIONS
  );
  const scanBudgetMs = Math.min(
    event.scanBudgetMs ?? SCAN_BUDGET_MS,
    SCAN_BUDGET_MS
  );

  if (invocation > maxInvocations) {
    throw new Error(
      `Exceeded maximum invocations (${maxInvocations}). Scan did not converge.`
    );
  }

  const startTime = Date.now();
  const deadlineMs = startTime + scanBudgetMs;
  const scanStartedAt =
    event.scanStartedAt ?? new Date(startTime).toISOString();
  const ageThresholds: AgeThresholds =
    event.ageThresholds ?? ageThresholdsFromNow(Math.floor(startTime / 1000));
  const tableName = getEnvironmentVariable("TABLE_NAME");

  const segmentsToScan = event.cursors
    ? event.cursors
        .map((cursor, segment) => ({ cursor, segment }))
        .filter(
          (entry): entry is { cursor: SegmentCursor; segment: number } =>
            entry.cursor !== null
        )
    : [...new Array(event.totalSegments).keys()].map((segment) => ({
        cursor: undefined as SegmentCursor | undefined,
        segment,
      }));

  const results = await Promise.all(
    segmentsToScan.map(({ segment, cursor }) =>
      scanSegment(
        client,
        tableName,
        segment,
        event.totalSegments,
        ageThresholds,
        {
          deadlineMs,
          resumeFrom: cursor,
        }
      )
    )
  );

  const scanDurationSeconds = Math.round((Date.now() - startTime) / 1000);
  const scanComplete = results.every((r) => r.exhausted);

  if (!scanComplete) {
    const nextCursors: (SegmentCursor | null)[] = new Array(
      event.totalSegments
    ).fill(null);
    for (let i = 0; i < segmentsToScan.length; i++) {
      nextCursors[segmentsToScan[i].segment] = results[i].cursor ?? null;
    }
    const functionName = getEnvironmentVariable("AWS_LAMBDA_FUNCTION_NAME");

    const nextEvent: AnalyseActivityLogEvent = {
      totalSegments: event.totalSegments,
      scanBudgetMs,
      maxInvocations,
      cursors: nextCursors,
      invocation: invocation + 1,
      ageThresholds,
      scanStartedAt,
    };

    const payload = Buffer.from(JSON.stringify(nextEvent));

    logger.info("Scan incomplete, invoking next chunk", {
      incompleteSegments: nextCursors.filter((c) => c !== null).length,
      scanDurationSeconds,
      payloadBytes: payload.byteLength,
    });

    if (payload.byteLength > 256_000) {
      throw new Error(
        `Payload too large for async invoke: ${payload.byteLength} bytes`
      );
    }

    const response = await lambdaClient.send(
      new InvokeCommand({
        FunctionName: functionName,
        InvocationType: InvocationType.Event,
        Payload: payload,
      })
    );

    if (response.StatusCode !== 202) {
      throw new Error(`Async invoke returned status ${response.StatusCode}`);
    }
  }

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

  const items_per_user_buckets = computeUserBuckets(totalCounts);

  const ageBucketSums = zeroedArray(AGE_BUCKET_LABELS.length);
  for (const r of results) {
    for (let i = 0; i < r.exclusiveAgeBuckets.length; i++) {
      ageBucketSums[i] += r.exclusiveAgeBuckets[i];
    }
  }
  const items_by_age_bucket = computeItemsByAgeBucket(ageBucketSums);

  const ttl_impact_simulation: Record<string, TtlSimulationResult> = {
    "3_months": computeTtlSimulation(
      allCounters,
      CounterIndex.OLDER_3M,
      totalItems
    ),
    "6_months": computeTtlSimulation(
      allCounters,
      CounterIndex.OLDER_6M,
      totalItems
    ),
    "12_months": computeTtlSimulation(
      allCounters,
      CounterIndex.OLDER_12M,
      totalItems
    ),
    "18_months": computeTtlSimulation(
      allCounters,
      CounterIndex.OLDER_18M,
      totalItems
    ),
    "24_months": computeTtlSimulation(
      allCounters,
      CounterIndex.OLDER_24M,
      totalItems
    ),
  };

  const report: ScanReport = {
    scan_date: scanStartedAt,
    total_items: totalItems,
    total_users: allCounters.length,
    scan_duration_seconds: Math.round(
      (Date.now() - new Date(scanStartedAt).getTime()) / 1000
    ),
    scan_complete: scanComplete,
    items_per_user_distribution,
    concentration,
    items_per_user_buckets,
    items_by_age_bucket,
    ttl_impact_simulation,
  };

  logger.info("Report complete", { ...report });

  return report;
};
