import { Logger } from "@aws-lambda-powertools/logger";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  LambdaClient,
  InvokeCommand,
  InvocationType,
} from "@aws-sdk/client-lambda";
import { Context } from "aws-lambda";
import { scanSegment, SegmentCursor } from "./scan-segment.js";
import { AgeThresholds, ageThresholdsFromNow } from "./age-thresholds.js";
import {
  buildChunkResult,
  mergeChunkResults,
  emptyChunkResult,
  ChunkResult,
} from "./chunk-result.js";
import {
  computePercentilesFromFrequency,
  computeConcentrationFromFrequency,
  computeUserBucketsFromFrequency,
  computeItemsByAgeBucket,
  computeTtlSimulationFromFrequency,
  AGE_BUCKET_LABELS,
  PercentileResult,
  ConcentrationResult,
  UserBucket,
  TtlSimulationResult,
} from "./compute-report.js";
import { getEnvironmentVariable } from "../common/utils.js";

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
  accumulated?: ChunkResult;
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

  const chunkResult = results.reduce((acc, r) => {
    const partial = buildChunkResult(r.perUserCounters, r.exclusiveAgeBuckets);
    return mergeChunkResults(acc, partial);
  }, emptyChunkResult(AGE_BUCKET_LABELS.length));

  const accumulated = event.accumulated
    ? mergeChunkResults(event.accumulated, chunkResult)
    : chunkResult;

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
      accumulated,
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

  const frequency = accumulated.totalCountFrequency;
  if (Object.keys(frequency).length === 0) {
    throw new Error("Scan returned no items");
  }

  let totalItems = 0;
  let totalUsers = 0;
  for (const [count, users] of Object.entries(frequency)) {
    totalItems += Number(count) * users;
    totalUsers += users;
  }

  const TTL_KEYS = [
    "3_months",
    "6_months",
    "12_months",
    "18_months",
    "24_months",
  ] as const;

  const ttl_impact_simulation: Record<string, TtlSimulationResult> = {};
  for (const key of TTL_KEYS) {
    ttl_impact_simulation[key] = computeTtlSimulationFromFrequency(
      accumulated.ttlRetainedFrequency[key],
      accumulated.usersFullyRemovedByTtl[key],
      totalItems,
      totalUsers
    );
  }

  const report: ScanReport = {
    scan_date: scanStartedAt,
    total_items: totalItems,
    total_users: totalUsers,
    scan_duration_seconds: Math.round(
      (Date.now() - new Date(scanStartedAt).getTime()) / 1000
    ),
    scan_complete: scanComplete,
    items_per_user_distribution: computePercentilesFromFrequency(frequency),
    concentration: computeConcentrationFromFrequency(frequency),
    items_per_user_buckets: computeUserBucketsFromFrequency(frequency),
    items_by_age_bucket: computeItemsByAgeBucket(accumulated.ageBuckets),
    ttl_impact_simulation,
  };

  logger.info("Report complete", { ...report });

  return report;
};
