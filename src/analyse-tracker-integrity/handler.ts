import { Logger } from "@aws-lambda-powertools/logger";
import {
  AttributeValue,
  DynamoDBClient,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import {
  LambdaClient,
  InvokeCommand,
  InvocationType,
} from "@aws-sdk/client-lambda";
import { Context } from "aws-lambda";
import { getEnvironmentVariable } from "../common/utils.js";
import { classifyItem } from "./classify-item.js";

const LAMBDA_TIMEOUT_MS = 15 * 60 * 1000;
const WRAP_UP_BUFFER_MS = 60 * 1000;
const SCAN_BUDGET_MS = LAMBDA_TIMEOUT_MS - WRAP_UP_BUFFER_MS;

const PROGRESS_LOG_INTERVAL = 500_000;

const logger = new Logger({ serviceName: "analyse-tracker-integrity" });
const client = new DynamoDBClient({});
const lambdaClient = new LambdaClient({});

interface SegmentCursor {
  segment: number;
  lastEvaluatedKey?: Record<string, AttributeValue>;
}

export interface AnalyseTrackerIntegrityEvent {
  totalSegments: number;
  cursors?: SegmentCursor[];
  invocation?: number;
  /** Overrides the computed wrap-up deadline. Exists for tests only. */
  deadlineMs?: number;
}

const scanSegment = async ({
  tableName,
  segment,
  totalSegments,
  resumeFrom,
  deadlineMs,
}: {
  tableName: string;
  segment: number;
  totalSegments: number;
  resumeFrom: Record<string, AttributeValue> | undefined;
  deadlineMs: number;
}): Promise<SegmentCursor | undefined> => {
  let totalScanned = 0;
  let lastEvaluatedKey = resumeFrom;

  do {
    const response = await client.send(
      new ScanCommand({
        TableName: tableName,
        Segment: segment,
        TotalSegments: totalSegments,
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    for (const item of response.Items ?? []) {
      totalScanned++;

      const result = classifyItem(item);
      if (result) {
        logger.warn("Tracker record failed integrity validation", {
          issues: result.issues,
          item: result.logEntry,
        });
      }

      if (totalScanned % PROGRESS_LOG_INTERVAL === 0) {
        logger.info("Segment progress", { segment, totalScanned });
      }
    }

    lastEvaluatedKey = response.LastEvaluatedKey;

    if (lastEvaluatedKey && Date.now() >= deadlineMs) {
      logger.info("Wrapping up segment before Lambda timeout", {
        segment,
        totalScanned,
      });
      return { segment, lastEvaluatedKey };
    }
  } while (lastEvaluatedKey);

  logger.info("Segment complete", { segment, totalScanned });

  return undefined;
};

export const handler = async (
  event: AnalyseTrackerIntegrityEvent,
  context: Context
): Promise<void> => {
  logger.addContext(context);

  if (
    !event.totalSegments ||
    !Number.isInteger(event.totalSegments) ||
    event.totalSegments < 1
  ) {
    throw new Error("totalSegments must be a positive integer");
  }

  const tableName = getEnvironmentVariable("TABLE_NAME");

  const invocation = event.invocation ?? 1;
  const deadlineMs = event.deadlineMs ?? Date.now() + SCAN_BUDGET_MS;

  logger.info("Scan started", {
    totalSegments: event.totalSegments,
    invocation,
  });

  const cursors: SegmentCursor[] =
    event.cursors ??
    [...new Array(event.totalSegments).keys()].map((segment) => ({
      segment,
    }));

  const nextCursors = (
    await Promise.all(
      cursors.map(({ segment, lastEvaluatedKey }) =>
        scanSegment({
          tableName,
          segment,
          totalSegments: event.totalSegments,
          resumeFrom: lastEvaluatedKey,
          deadlineMs,
        })
      )
    )
  ).filter((cursor): cursor is SegmentCursor => cursor !== undefined);

  if (nextCursors.length === 0) {
    logger.info("Integrity scan complete");
    return;
  }

  const functionName = getEnvironmentVariable("AWS_LAMBDA_FUNCTION_NAME");

  const nextEvent: AnalyseTrackerIntegrityEvent = {
    totalSegments: event.totalSegments,
    cursors: nextCursors,
    invocation: invocation + 1,
  };

  logger.info("Scan incomplete, invoking next chunk", {
    incompleteSegments: nextCursors.length,
  });

  const response = await lambdaClient.send(
    new InvokeCommand({
      FunctionName: functionName,
      InvocationType: InvocationType.Event,
      Payload: Buffer.from(JSON.stringify(nextEvent)),
    })
  );

  if (response.StatusCode !== 202) {
    throw new Error(`Async invoke returned status ${response.StatusCode}`);
  }
};
