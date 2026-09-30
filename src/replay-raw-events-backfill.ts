import { Context } from "aws-lambda";
import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import {
  SQSClient,
  SendMessageBatchCommand,
  SendMessageBatchRequestEntry,
} from "@aws-sdk/client-sqs";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import {
  SSMClient,
  GetParameterCommand,
  PutParameterCommand,
  DeleteParameterCommand,
} from "@aws-sdk/client-ssm";
import { Logger } from "@aws-lambda-powertools/logger";
import { getEnvironmentVariable } from "./common/utils.js";
import type { AttributeValue } from "@aws-sdk/client-dynamodb";

const logger = new Logger();
const dynamoClient = new DynamoDBClient({});
const sqsClient = new SQSClient({});
const lambdaClient = new LambdaClient({});
const ssmClient = new SSMClient({});

const TOTAL_SEGMENTS = 10;
// Reinvoke with ~60s remaining to allow time for the invocation and any in-flight batch
const REINVOKE_THRESHOLD_MS = 60_000;
const CHECKPOINT_INTERVAL_MS = 60_000;

interface CheckpointState {
  segmentCursors: (Record<string, AttributeValue> | null | undefined)[];
  totalDispatched: number;
}

export interface ReplayInput {
  fresh?: boolean;
}

const loadCheckpoint = async (
  parameterName: string
): Promise<CheckpointState | null> => {
  try {
    const result = await ssmClient.send(
      new GetParameterCommand({ Name: parameterName })
    );
    return result.Parameter?.Value
      ? (JSON.parse(result.Parameter.Value) as CheckpointState)
      : null;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "ParameterNotFound") {
      return null;
    }
    throw error;
  }
};

const saveCheckpoint = async (
  parameterName: string,
  state: CheckpointState
): Promise<void> => {
  await ssmClient.send(
    new PutParameterCommand({
      Name: parameterName,
      Value: JSON.stringify(state),
      Type: "String",
      Overwrite: true,
    })
  );
};

const clearCheckpoint = async (parameterName: string): Promise<void> => {
  await ssmClient.send(new DeleteParameterCommand({ Name: parameterName }));
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
  item: Record<string, unknown>
): Record<string, unknown> => ({
  eventName: "INSERT",
  dynamodb: {
    NewImage: {
      event: {
        M: item["event"],
      },
    },
    SequenceNumber: item["id"] ?? "backfill",
  },
});

const dispatchItems = async (
  queueUrl: string,
  items: ReturnType<typeof unmarshall>[]
): Promise<number> => {
  for (let i = 0; i < items.length; i += 10) {
    const batch = items.slice(i, i + 10);
    const entries: SendMessageBatchRequestEntry[] = batch.map((item, idx) => ({
      Id: String(idx),
      MessageBody: JSON.stringify({ Records: [buildStreamRecord(item)] }),
    }));
    // batches must be sent sequentially to avoid overwhelming SQS
    // hence the await inside the loop
    await sendBatch(queueUrl, entries);
  }
  return items.length;
};

const processSegment = async (
  segment: number,
  cursor: Record<string, AttributeValue> | null,
  tableName: string,
  queueUrl: string
): Promise<{
  nextCursor: Record<string, AttributeValue> | undefined;
  dispatched: number;
}> => {
  const scanResult = await dynamoClient.send(
    new ScanCommand({
      TableName: tableName,
      Segment: segment,
      TotalSegments: TOTAL_SEGMENTS,
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

  const dispatched = await dispatchItems(
    queueUrl,
    (scanResult.Items ?? []).map((item) => unmarshall(item))
  );

  return { nextCursor: scanResult.LastEvaluatedKey, dispatched };
};

export const handler = async (
  event: ReplayInput,
  context: Context
): Promise<void> => {
  const tableName = getEnvironmentVariable("BACKFILL_TABLE_NAME");
  const queueUrl = getEnvironmentVariable("BACKFILL_QUEUE_URL");
  const functionName = getEnvironmentVariable("AWS_LAMBDA_FUNCTION_NAME");
  const checkpointParameter = getEnvironmentVariable(
    "CHECKPOINT_PARAMETER_NAME"
  );

  const existingCheckpoint = event.fresh
    ? null
    : await loadCheckpoint(checkpointParameter);

  const segmentCursors: (Record<string, AttributeValue> | null | undefined)[] =
    existingCheckpoint?.segmentCursors ??
    new Array<null>(TOTAL_SEGMENTS).fill(null);

  let totalDispatched = existingCheckpoint?.totalDispatched ?? 0;

  logger.info("Replay backfill started", {
    totalDispatched,
    resumedFromCheckpoint: existingCheckpoint !== null,
    segmentsRemaining: segmentCursors.filter((c) => c !== undefined).length,
  });

  let lastCheckpointTime = Date.now();

  // Round-robin across segments so we make progress on all of them evenly
  // before a potential reinvocation
  let madeProgress = true;
  while (madeProgress) {
    madeProgress = false;

    for (let segment = 0; segment < TOTAL_SEGMENTS; segment++) {
      if (segmentCursors[segment] === undefined) continue;

      if (context.getRemainingTimeInMillis() < REINVOKE_THRESHOLD_MS) {
        logger.info("Approaching timeout, reinvoking", {
          totalDispatched,
          remainingMs: context.getRemainingTimeInMillis(),
        });
        await saveCheckpoint(checkpointParameter, {
          segmentCursors,
          totalDispatched,
        });
        await lambdaClient.send(
          new InvokeCommand({
            FunctionName: functionName,
            InvocationType: "Event",
            Payload: Buffer.from(JSON.stringify({})),
          })
        );
        return;
      }

      if (Date.now() - lastCheckpointTime >= CHECKPOINT_INTERVAL_MS) {
        // must reflect current cursor state, cannot be parallelised
        // hence the await inside the loop
        await saveCheckpoint(checkpointParameter, {
          segmentCursors,
          totalDispatched,
        });
        lastCheckpointTime = Date.now();
        logger.info("Checkpoint saved", { totalDispatched });
      }

      // each segment depends on the previous cursor state hence the
      // await inside the loop
      const { nextCursor, dispatched } = await processSegment(
        segment,
        segmentCursors[segment] ?? null,
        tableName,
        queueUrl
      );

      totalDispatched += dispatched;
      madeProgress = true;

      if (nextCursor) {
        segmentCursors[segment] = nextCursor;
      } else {
        segmentCursors[segment] = undefined;
        logger.info(`Segment ${segment} complete`, { totalDispatched });
      }
    }
  }

  await clearCheckpoint(checkpointParameter);
  logger.info("Replay backfill complete", { totalDispatched });
};
