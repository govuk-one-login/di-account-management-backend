import { vi, describe, test, expect, beforeEach, afterEach } from "vitest";
import {
  DynamoDBClient,
  ScanCommand,
  GetItemCommand,
  PutItemCommand,
  DeleteItemCommand,
} from "@aws-sdk/client-dynamodb";
import { SQSClient, SendMessageBatchCommand } from "@aws-sdk/client-sqs";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { mockClient } from "aws-sdk-client-mock";
import type { Context } from "aws-lambda";
import { marshall } from "@aws-sdk/util-dynamodb";

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  addContext: vi.fn(),
}));

vi.mock("@aws-lambda-powertools/logger", () => ({
  Logger: class {
    info = mockLogger.info;
    error = mockLogger.error;
    addContext = mockLogger.addContext;
  },
}));

import { handler } from "../replay-raw-events-backfill.js";

const dynamoMock = mockClient(DynamoDBClient);
const sqsMock = mockClient(SQSClient);
const lambdaMock = mockClient(LambdaClient);

const BACKFILL_TABLE_NAME = "raw_events_restored_iad_dpt_backfill";
const BACKFILL_QUEUE_URL =
  "https://sqs.eu-west-2.amazonaws.com/123/backfill-queue";
const FUNCTION_NAME = "production-stack-replay-raw-events-backfill";
const CHECKPOINT_TABLE_NAME = "replay-raw-events-backfill-checkpoint";

const makeContext = (remainingMs = 900_000): Context =>
  ({
    getRemainingTimeInMillis: () => remainingMs,
  }) as unknown as Context;

const makeItem = (eventName: string, id = "item-id") =>
  marshall({
    id,
    event: {
      event_name: eventName,
      event_id: "evt-123",
      timestamp: 1700000000,
      user: { user_id: "user-1", session_id: "sess-1" },
    },
  });

const EMPTY_SCAN = { Items: [], LastEvaluatedKey: undefined };

const TOTAL_SEGMENTS = 100;

// Returns a scan mock that returns one page of items for segment 0 and empty for all others
const setupSinglePageScan = (eventName: string, itemCount = 1) => {
  const items = Array.from({ length: itemCount }, (_, i) =>
    makeItem(eventName, `item-${i}`)
  );
  dynamoMock
    .on(ScanCommand, { Segment: 0 })
    .resolvesOnce({ Items: items, LastEvaluatedKey: undefined });
  for (let seg = 1; seg < TOTAL_SEGMENTS; seg++) {
    dynamoMock.on(ScanCommand, { Segment: seg }).resolvesOnce(EMPTY_SCAN);
  }
};

beforeEach(() => {
  dynamoMock.reset();
  sqsMock.reset();
  lambdaMock.reset();

  process.env.BACKFILL_TABLE_NAME = BACKFILL_TABLE_NAME;
  process.env.BACKFILL_QUEUE_URL = BACKFILL_QUEUE_URL;
  process.env.AWS_LAMBDA_FUNCTION_NAME = FUNCTION_NAME;
  process.env.CHECKPOINT_TABLE_NAME = CHECKPOINT_TABLE_NAME;
  process.env.TOTAL_SEGMENTS = String(TOTAL_SEGMENTS);

  dynamoMock.on(GetItemCommand).resolves({ Item: undefined });
  dynamoMock.on(PutItemCommand).resolves({});
  dynamoMock.on(DeleteItemCommand).resolves({});
  sqsMock.on(SendMessageBatchCommand).resolves({ Successful: [], Failed: [] });
  lambdaMock.on(InvokeCommand).resolves({});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("checkpoint loading", () => {
  test("starts fresh when no checkpoint exists", async () => {
    setupSinglePageScan("AUTH_CODE_VERIFIED");

    await handler({}, makeContext());

    expect(dynamoMock).toHaveReceivedCommandWith(GetItemCommand, {
      TableName: CHECKPOINT_TABLE_NAME,
      Key: { id: { S: "CHECKPOINT" } },
    });
    expect(mockLogger.info).toHaveBeenCalledWith(
      "Replay backfill started",
      expect.objectContaining({ resumedFromCheckpoint: false })
    );
  });

  test("resumes from checkpoint when one exists", async () => {
    const cursor = { id: { S: "last-seen-id" }, timestamp: { N: "123" } };
    const checkpoint = {
      segmentCursors: [cursor, ...new Array(99).fill("NOT_STARTED")],
      totalDispatched: 500,
    };
    dynamoMock.on(GetItemCommand).resolves({
      Item: {
        id: { S: "CHECKPOINT" },
        state: { S: JSON.stringify(checkpoint) },
      },
    });
    // Segment 0 has one more page, all others empty
    dynamoMock.on(ScanCommand, { Segment: 0 }).resolvesOnce({
      Items: [makeItem("AUTH_CODE_VERIFIED")],
      LastEvaluatedKey: undefined,
    });
    for (let seg = 1; seg < TOTAL_SEGMENTS; seg++) {
      dynamoMock.on(ScanCommand, { Segment: seg }).resolvesOnce(EMPTY_SCAN);
    }

    await handler({}, makeContext());

    expect(mockLogger.info).toHaveBeenCalledWith(
      "Replay backfill started",
      expect.objectContaining({
        resumedFromCheckpoint: true,
        totalDispatched: 500,
      })
    );
    // Segment 0 scan should use the cursor as ExclusiveStartKey
    expect(dynamoMock).toHaveReceivedCommandWith(ScanCommand, {
      Segment: 0,
      ExclusiveStartKey: cursor,
    });
  });

  test("ignores checkpoint and starts fresh when fresh: true", async () => {
    setupSinglePageScan("AUTH_CODE_VERIFIED");

    await handler({ fresh: true }, makeContext());

    expect(dynamoMock).not.toHaveReceivedCommand(GetItemCommand);
    expect(mockLogger.info).toHaveBeenCalledWith(
      "Replay backfill started",
      expect.objectContaining({
        resumedFromCheckpoint: false,
        totalDispatched: 0,
      })
    );
  });

  test("throws when DynamoDB GetItem fails with an unexpected error", async () => {
    dynamoMock.on(GetItemCommand).rejects(new Error("AccessDenied"));

    await expect(handler({}, makeContext())).rejects.toThrow("AccessDenied");
  });
});

describe("scanning and dispatching", () => {
  test("scans all 100 segments", async () => {
    for (let seg = 0; seg < TOTAL_SEGMENTS; seg++) {
      dynamoMock.on(ScanCommand, { Segment: seg }).resolvesOnce(EMPTY_SCAN);
    }

    await handler({}, makeContext());

    expect(dynamoMock.commandCalls(ScanCommand).length).toBe(TOTAL_SEGMENTS);
  });

  test("sends matching items to SQS as stream-shaped records", async () => {
    setupSinglePageScan("AUTH_CODE_VERIFIED");

    await handler({}, makeContext());

    expect(sqsMock).toHaveReceivedCommandWith(SendMessageBatchCommand, {
      QueueUrl: BACKFILL_QUEUE_URL,
      Entries: expect.arrayContaining([
        expect.objectContaining({
          MessageBody: expect.stringContaining('"eventName":"INSERT"'),
        }),
      ]),
    });
  });

  test("message body contains NewImage with marshalled event.M", async () => {
    setupSinglePageScan("STS_REFRESH_TOKEN_ISSUED");

    await handler({}, makeContext());

    const calls = sqsMock.commandCalls(SendMessageBatchCommand);
    expect(calls.length).toBe(1);
    const body = JSON.parse(calls[0].args[0].input.Entries![0].MessageBody!);
    const newImage = body.Records[0].dynamodb.NewImage;
    // event.M must contain AttributeValue-shaped objects (e.g. { S: "..." }),
    // not plain JS values — the tracker handler calls unmarshall() on it
    expect(newImage.event.M.event_name).toEqual({
      S: "STS_REFRESH_TOKEN_ISSUED",
    });
    expect(newImage.event.M.user.M.user_id).toEqual({ S: "user-1" });
  });

  test("batches items into groups of 10 for SQS", async () => {
    // 25 items on segment 0
    const items = Array.from({ length: 25 }, (_, i) =>
      makeItem("AUTH_CODE_VERIFIED", `item-${i}`)
    );
    dynamoMock.on(ScanCommand).resolves(EMPTY_SCAN);
    dynamoMock
      .on(ScanCommand, { Segment: 0 })
      .resolvesOnce({ Items: items, LastEvaluatedKey: undefined });

    await handler({}, makeContext());

    const calls = sqsMock.commandCalls(SendMessageBatchCommand);
    // 3 batches: 10 + 10 + 5
    expect(calls.length).toBe(3);
    expect(calls[0].args[0].input.Entries!.length).toBe(10);
    expect(calls[1].args[0].input.Entries!.length).toBe(10);
    expect(calls[2].args[0].input.Entries!.length).toBe(5);
  });

  test("paginates a segment when LastEvaluatedKey is returned", async () => {
    const cursor = { id: { S: "page-1-last" } };
    dynamoMock
      .on(ScanCommand, { Segment: 0 })
      .resolvesOnce({
        Items: [makeItem("AUTH_CODE_VERIFIED", "p1")],
        LastEvaluatedKey: cursor,
      })
      .resolvesOnce({
        Items: [makeItem("AUTH_CODE_VERIFIED", "p2")],
        LastEvaluatedKey: undefined,
      });
    for (let seg = 1; seg < TOTAL_SEGMENTS; seg++) {
      dynamoMock.on(ScanCommand, { Segment: seg }).resolves(EMPTY_SCAN);
    }

    await handler({}, makeContext());

    const scanCalls = dynamoMock
      .commandCalls(ScanCommand)
      .filter((c) => c.args[0].input.Segment === 0);
    expect(scanCalls.length).toBe(2);
    expect(scanCalls[1].args[0].input.ExclusiveStartKey).toEqual(cursor);
    expect(sqsMock.commandCalls(SendMessageBatchCommand).length).toBe(2);
  });

  test("does not send to SQS when scan returns no items", async () => {
    dynamoMock.on(ScanCommand).resolves(EMPTY_SCAN);

    await handler({}, makeContext());

    expect(sqsMock.commandCalls(SendMessageBatchCommand).length).toBe(0);
  });

  test("throws when SQS batch has failures", async () => {
    setupSinglePageScan("AUTH_CODE_VERIFIED");
    sqsMock.on(SendMessageBatchCommand).resolves({
      Failed: [
        {
          Id: "0",
          Code: "ServiceUnavailable",
          Message: "Service error",
          SenderFault: false,
        },
      ],
    });

    await expect(handler({}, makeContext())).rejects.toThrow(
      "SQS batch had 1 failures"
    );
  });
});

describe("timeout and reinvocation", () => {
  test("reinvokes itself when approaching timeout", async () => {
    // Context reports < 60s remaining from the start — timeout is checked before
    // each round so no scans will occur
    await handler({}, makeContext(59_000));

    expect(lambdaMock).toHaveReceivedCommandWith(InvokeCommand, {
      FunctionName: FUNCTION_NAME,
      InvocationType: "Event",
      Payload: Buffer.from(JSON.stringify({})),
    });
  });

  test("saves checkpoint to SSM before reinvoking", async () => {
    for (let seg = 0; seg < TOTAL_SEGMENTS; seg++) {
      dynamoMock.on(ScanCommand, { Segment: seg }).resolves(EMPTY_SCAN);
    }

    await handler({}, makeContext(59_000));

    const ssmCalls = dynamoMock.commandCalls(PutItemCommand);
    const lambdaCalls = lambdaMock.commandCalls(InvokeCommand);
    expect(ssmCalls.length).toBeGreaterThan(0);
    expect(lambdaCalls.length).toBeGreaterThan(0);
    expect(ssmCalls[ssmCalls.length - 1].args[0].input.TableName).toBe(
      CHECKPOINT_TABLE_NAME
    );
  });

  test("returns without completing scan when reinvoking", async () => {
    // All segments have more pages, but we're near timeout immediately
    for (let seg = 0; seg < TOTAL_SEGMENTS; seg++) {
      dynamoMock.on(ScanCommand, { Segment: seg }).resolves({
        Items: [makeItem("AUTH_CODE_VERIFIED")],
        LastEvaluatedKey: { id: { S: "cursor" } },
      });
    }

    await handler({}, makeContext(59_000));

    // Should not have cleared the checkpoint (that only happens on completion)
    expect(dynamoMock).not.toHaveReceivedCommand(DeleteItemCommand);
    expect(mockLogger.info).not.toHaveBeenCalledWith(
      "Replay backfill complete",
      expect.anything()
    );
  });
});

describe("periodic checkpointing", () => {
  test("saves checkpoint when 60s have elapsed since last checkpoint", async () => {
    let callCount = 0;
    const NOW = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => {
      // First call (initialising lastCheckpointTime): return NOW
      // Second call (checking elapsed time inside loop): return NOW + 61s
      return callCount++ === 0 ? NOW : NOW + 61_000;
    });

    setupSinglePageScan("AUTH_CODE_VERIFIED");

    await handler({}, makeContext());

    expect(dynamoMock).toHaveReceivedCommand(PutItemCommand);
    expect(mockLogger.info).toHaveBeenCalledWith(
      "Checkpoint saved",
      expect.objectContaining({ totalDispatched: expect.any(Number) })
    );

    vi.spyOn(Date, "now").mockRestore();
  });

  test("does not save checkpoint when less than 60s have elapsed", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);

    setupSinglePageScan("AUTH_CODE_VERIFIED");

    await handler({}, makeContext());

    expect(dynamoMock).not.toHaveReceivedCommand(PutItemCommand);

    vi.spyOn(Date, "now").mockRestore();
  });
});

describe("completion", () => {
  test("clears checkpoint on successful completion", async () => {
    for (let seg = 0; seg < TOTAL_SEGMENTS; seg++) {
      dynamoMock.on(ScanCommand, { Segment: seg }).resolvesOnce(EMPTY_SCAN);
    }

    await handler({}, makeContext());

    expect(dynamoMock).toHaveReceivedCommandWith(DeleteItemCommand, {
      TableName: CHECKPOINT_TABLE_NAME,
      Key: { id: { S: "CHECKPOINT" } },
    });
  });

  test("logs completion with total dispatched count", async () => {
    setupSinglePageScan("AUTH_CODE_VERIFIED", 3);

    await handler({}, makeContext());

    expect(mockLogger.info).toHaveBeenCalledWith("Replay backfill complete", {
      totalDispatched: 3,
    });
  });

  test("does not reinvoke Lambda on completion", async () => {
    for (let seg = 0; seg < TOTAL_SEGMENTS; seg++) {
      dynamoMock.on(ScanCommand, { Segment: seg }).resolvesOnce(EMPTY_SCAN);
    }

    await handler({}, makeContext());

    expect(lambdaMock).not.toHaveReceivedCommand(InvokeCommand);
  });
});

describe("scan parameters", () => {
  test("scans with correct filter expression for all 4 event names", async () => {
    setupSinglePageScan("AUTH_CODE_VERIFIED");

    await handler({}, makeContext());

    expect(dynamoMock).toHaveReceivedCommandWith(ScanCommand, {
      TableName: BACKFILL_TABLE_NAME,
      FilterExpression: "event.event_name IN (:e1, :e2, :e3, :e4)",
      ExpressionAttributeValues: {
        ":e1": { S: "AUTH_TOKEN_SENT_TO_ORCHESTRATION" },
        ":e2": { S: "AUTH_CODE_VERIFIED" },
        ":e3": { S: "AUTH_PASSKEY_VERIFICATION_SUCCESSFUL" },
        ":e4": { S: "STS_REFRESH_TOKEN_ISSUED" },
      },
    });
  });

  test("scans with TotalSegments: 100", async () => {
    setupSinglePageScan("AUTH_CODE_VERIFIED");

    await handler({}, makeContext());

    const calls = dynamoMock.commandCalls(ScanCommand);
    for (const call of calls) {
      expect(call.args[0].input.TotalSegments).toBe(TOTAL_SEGMENTS);
    }
  });

  test("uses projection to fetch only id and event fields", async () => {
    setupSinglePageScan("AUTH_CODE_VERIFIED");

    await handler({}, makeContext());

    expect(dynamoMock).toHaveReceivedCommandWith(ScanCommand, {
      ProjectionExpression: "id, #evt",
      ExpressionAttributeNames: { "#evt": "event" },
    });
  });
});
