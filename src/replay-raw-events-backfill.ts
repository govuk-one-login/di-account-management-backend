import { Context } from "aws-lambda";
import {
  DynamoDBClient,
  ScanCommand,
  GetItemCommand,
  PutItemCommand,
  DeleteItemCommand,
} from "@aws-sdk/client-dynamodb";
import {
  SQSClient,
  SendMessageBatchCommand,
  SendMessageBatchRequestEntry,
} from "@aws-sdk/client-sqs";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { getEnvironmentVariable } from "./common/utils.js";
import type { AttributeValue } from "@aws-sdk/client-dynamodb";

const logger = new Logger();
const dynamoClient = new DynamoDBClient({});
const sqsClient = new SQSClient({});
const lambdaClient = new LambdaClient({});

type SegmentCursor =
  "NOT_STARTED" | "FINISHED" | Record<string, AttributeValue>;
const REINVOKE_THRESHOLD_MS = 150_000;
const CHECKPOINT_INTERVAL_MS = 60_000;

interface CheckpointState {
  segmentCursors: SegmentCursor[];
  totalDispatched: number;
}

export interface ReplayInput {
  fresh?: boolean;
}

const CHECKPOINT_KEY = "CHECKPOINT";

const loadCheckpoint = async (
  tableName: string
): Promise<CheckpointState | null> => {
  const result = await dynamoClient.send(
    new GetItemCommand({
      TableName: tableName,
      Key: { id: { S: CHECKPOINT_KEY } },
    })
  );
  return result.Item?.state?.S
    ? (JSON.parse(result.Item.state.S) as CheckpointState)
    : null;
};

const saveCheckpoint = async (
  tableName: string,
  state: CheckpointState
): Promise<void> => {
  await dynamoClient.send(
    new PutItemCommand({
      TableName: tableName,
      Item: { id: { S: CHECKPOINT_KEY }, state: { S: JSON.stringify(state) } },
    })
  );
};

const clearCheckpoint = async (tableName: string): Promise<void> => {
  await dynamoClient.send(
    new DeleteItemCommand({
      TableName: tableName,
      Key: { id: { S: CHECKPOINT_KEY } },
    })
  );
};

const sendBatch = async (
  queueUrl: string,
  entries: SendMessageBatchRequestEntry[]
): Promise<void> => {
  const result = await sqsClient.send(
    new SendMessageBatchCommand({ QueueUrl: queueUrl, Entries: entries })
  );
  if (result.Failed?.length) {
    throw new Error(
      `SQS batch had ${result.Failed.length} failures: ${result.Failed.map((f) => f.Message).join(", ")}`
    );
  }
};

const buildStreamRecord = (
  item: Record<string, AttributeValue>
): Record<string, unknown> => ({
  eventName: "INSERT",
  dynamodb: {
    NewImage: {
      event: {
        M: item["event"]?.M,
      },
    },
    SequenceNumber: item["id"]?.S ?? "backfill",
  },
});

const dispatchItems = async (
  queueUrl: string,
  items: Record<string, AttributeValue>[]
): Promise<number> => {
  await Promise.all(
    Array.from({ length: Math.ceil(items.length / 10) }, (_, i) => {
      const batch = items.slice(i * 10, (i + 1) * 10);
      const entries: SendMessageBatchRequestEntry[] = batch.map(
        (item, idx) => ({
          Id: String(idx),
          MessageBody: JSON.stringify({ Records: [buildStreamRecord(item)] }),
        })
      );
      return sendBatch(queueUrl, entries);
    })
  );
  return items.length;
};

const processSegment = async (
  segment: number,
  cursor: Record<string, AttributeValue> | null,
  tableName: string,
  queueUrl: string,
  totalSegments: number
): Promise<{
  nextCursor: Record<string, AttributeValue> | undefined;
  dispatched: number;
}> => {
  const scanResult = await dynamoClient.send(
    new ScanCommand({
      TableName: tableName,
      Segment: segment,
      TotalSegments: totalSegments,
      ExclusiveStartKey: cursor ?? undefined,
      FilterExpression: "event.event_name IN (:e1, :e2, :e3, :e4)",
      ExpressionAttributeValues: {
        ":e1": { S: "AUTH_TOKEN_SENT_TO_ORCHESTRATION" },
        ":e2": { S: "AUTH_CODE_VERIFIED" },
        ":e3": { S: "AUTH_PASSKEY_VERIFICATION_SUCCESSFUL" },
        ":e4": { S: "STS_REFRESH_TOKEN_ISSUED" },
      },
      ProjectionExpression: "id, #evt",
      ExpressionAttributeNames: { "#evt": "event" },
    })
  );

  const dispatched = await dispatchItems(queueUrl, scanResult.Items ?? []);

  return { nextCursor: scanResult.LastEvaluatedKey, dispatched };
};

export const handler = async (
  event: ReplayInput,
  context: Context
): Promise<void> => {
  const tableName = getEnvironmentVariable("BACKFILL_TABLE_NAME");
  const queueUrl = getEnvironmentVariable("BACKFILL_QUEUE_URL");
  const functionName = getEnvironmentVariable("AWS_LAMBDA_FUNCTION_NAME");
  const totalSegments = Number(getEnvironmentVariable("TOTAL_SEGMENTS"));
  const checkpointTableName = getEnvironmentVariable("CHECKPOINT_TABLE_NAME");

  const existingCheckpoint = event.fresh
    ? null
    : await loadCheckpoint(checkpointTableName);

  const segmentCursors: SegmentCursor[] =
    existingCheckpoint?.segmentCursors ??
    new Array<"NOT_STARTED">(totalSegments).fill("NOT_STARTED");

  let totalDispatched = existingCheckpoint?.totalDispatched ?? 0;

  logger.info("Replay backfill started", {
    totalDispatched,
    resumedFromCheckpoint: existingCheckpoint !== null,
    segmentsRemaining: segmentCursors.filter((c) => c !== "FINISHED").length,
  });

  let lastCheckpointTime = Date.now();

  while (segmentCursors.some((c) => c !== "FINISHED")) {
    if (context.getRemainingTimeInMillis() < REINVOKE_THRESHOLD_MS) {
      logger.info("Approaching timeout, reinvoking", {
        totalDispatched,
        remainingMs: context.getRemainingTimeInMillis(),
      });
      await Promise.allSettled([
        saveCheckpoint(checkpointTableName, {
          segmentCursors,
          totalDispatched,
        }),
        lambdaClient.send(
          new InvokeCommand({
            FunctionName: functionName,
            InvocationType: "Event",
            Payload: Buffer.from(JSON.stringify({})),
          })
        ),
      ]);
      return;
    }

    if (Date.now() - lastCheckpointTime >= CHECKPOINT_INTERVAL_MS) {
      await saveCheckpoint(checkpointTableName, {
        segmentCursors,
        totalDispatched,
      });
      lastCheckpointTime = Date.now();
      logger.info("Checkpoint saved", { totalDispatched });
    }

    const results = await Promise.all(
      segmentCursors.map((cursor, segment) => {
        if (cursor === "FINISHED") return Promise.resolve(null);
        return processSegment(
          segment,
          cursor === "NOT_STARTED"
            ? null
            : (cursor as Record<string, AttributeValue>),
          tableName,
          queueUrl,
          totalSegments
        );
      })
    );

    results.forEach((result, segment) => {
      if (result === null) return;
      totalDispatched += result.dispatched;
      if (result.nextCursor) {
        segmentCursors[segment] = result.nextCursor;
      } else {
        segmentCursors[segment] = "FINISHED";
        logger.info(`Segment ${segment} complete`, { totalDispatched });
      }
    });
  }

  await clearCheckpoint(checkpointTableName);
  logger.info("Replay backfill complete", { totalDispatched });
};
