import {
  AttributeValue,
  DynamoDBClient,
  ScanCommand,
  ScanCommandOutput,
} from "@aws-sdk/client-dynamodb";
import { Logger } from "@aws-lambda-powertools/logger";
import { zeroedArray, normaliseTimestamp } from "../common/utils.js";
import {
  AgeThresholds,
  CounterIndex,
  getAgeCounterIndex,
  incrementCounters,
} from "./age-thresholds.js";
import { AGE_BUCKET_LABELS } from "./compute-report.js";

export interface SegmentResult {
  perUserCounters: number[][];
  exclusiveAgeBuckets: number[];
}

export interface SegmentCursor {
  lastEvaluatedKey: Record<string, AttributeValue>;
  lastUserId: string;
  lastUserCounters: number[];
}

export interface TimedSegmentResult extends SegmentResult {
  exhausted: boolean;
  cursor?: SegmentCursor;
}

const logger = new Logger({ serviceName: "analyse-activity-log" });

const processItem = (
  item: Record<string, AttributeValue>,
  ageThresholds: AgeThresholds,
  state: {
    perUserCounters: number[][];
    exclusiveAgeBuckets: number[];
    currentUserId: string | null;
    counters: number[];
    totalItems: number;
  }
): typeof state => {
  const userId = item.user_id?.S;
  const ts = normaliseTimestamp(Number(item.timestamp?.N));
  if (!userId || Number.isNaN(ts)) return state;

  if (userId !== state.currentUserId) {
    if (state.currentUserId !== null) {
      state.perUserCounters.push(state.counters);
    }
    state.currentUserId = userId;
    state.counters = zeroedArray(Object.keys(CounterIndex).length);
  }

  state.totalItems++;
  const ageCounterIndex = getAgeCounterIndex(ts, ageThresholds);
  incrementCounters(state.counters, ageCounterIndex);
  state.exclusiveAgeBuckets[ageCounterIndex]++;

  return state;
};

export const scanSegment = async (
  client: DynamoDBClient,
  tableName: string,
  segment: number,
  totalSegments: number,
  ageThresholds: AgeThresholds,
  options?: { deadlineMs?: number; resumeFrom?: SegmentCursor }
): Promise<TimedSegmentResult> => {
  const state = {
    perUserCounters: [] as number[][],
    exclusiveAgeBuckets: zeroedArray(AGE_BUCKET_LABELS.length),
    currentUserId: options?.resumeFrom?.lastUserId ?? null,
    counters: options?.resumeFrom?.lastUserCounters
      ? [...options.resumeFrom.lastUserCounters]
      : zeroedArray(Object.keys(CounterIndex).length),
    totalItems: 0,
  };

  let lastEvaluatedKey: ScanCommandOutput["LastEvaluatedKey"] =
    options?.resumeFrom?.lastEvaluatedKey;
  const hasDeadline = options?.deadlineMs !== undefined;

  do {
    const response = await client.send(
      new ScanCommand({
        TableName: tableName,
        ProjectionExpression: "user_id, #ts",
        ExpressionAttributeNames: { "#ts": "timestamp" },
        Segment: segment,
        TotalSegments: totalSegments,
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    for (const item of response.Items ?? []) {
      processItem(item, ageThresholds, state);

      if (state.totalItems % 10_000 === 0) {
        logger.info("Segment progress", { segment, items: state.totalItems });
      }
    }

    lastEvaluatedKey = response.LastEvaluatedKey;

    if (hasDeadline && lastEvaluatedKey && Date.now() >= options.deadlineMs!) {
      logger.info("Segment deadline reached", {
        segment,
        items: state.totalItems,
      });

      return {
        perUserCounters: state.perUserCounters,
        exclusiveAgeBuckets: state.exclusiveAgeBuckets,
        exhausted: false,
        cursor: {
          lastEvaluatedKey,
          lastUserId: state.currentUserId!,
          lastUserCounters: state.counters,
        },
      };
    }
  } while (lastEvaluatedKey);

  if (state.currentUserId !== null) {
    state.perUserCounters.push(state.counters);
  }

  logger.info("Segment complete", {
    segment,
    users: state.perUserCounters.length,
    items: state.totalItems,
  });

  return {
    perUserCounters: state.perUserCounters,
    exclusiveAgeBuckets: state.exclusiveAgeBuckets,
    exhausted: true,
  };
};
