import { vi, describe, test, expect, beforeEach } from "vitest";
import { Context } from "aws-lambda";
import {
  AttributeValue,
  DynamoDBClient,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const dynamoMock = mockClient(DynamoDBClient);
const lambdaMock = mockClient(LambdaClient);

import { handler } from "../../analyse-tracker-integrity/handler.js";

const mockContext = {} as Context;

const cleanItem = (): Record<string, AttributeValue> => ({
  dateForDeletion: { S: "2026-01-01" },
  commonSubjectId: { S: "common-subject-id-123" },
  publicSubjectId: { S: "public-subject-id-123" },
  status: { S: "pending" },
  statusLastUpdated: { S: "2026-01-01T00:00:00.000Z" },
  userLastActive: { S: "2025-01-01T00:00:00.000Z" },
  userLastActiveSource: { S: "AUTH_AUTH_CODE_ISSUED" },
  userLastActiveSourceId: { S: "event-id-123" },
  userLastActiveUpdated: { S: "2026-01-01T00:00:00.000Z" },
  emailAddress: { S: "user@example.com" },
  emailAddressLastUpdated: { S: "2026-01-01T00:00:00.000Z" },
  emailAddressSource: { S: "AUTH_UPDATE_EMAIL" },
  emailAddressSourceId: { S: "event-id-456" },
  hasSetupMfa: { BOOL: true },
  hasUndeliverableEmailAddress: { BOOL: false },
});

const anomalousItem = (): Record<string, AttributeValue> => {
  const item = cleanItem();
  delete (item as Record<string, unknown>).emailAddress;
  return item;
};

describe("analyse-tracker-integrity handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dynamoMock.reset();
    lambdaMock.reset();
    lambdaMock.on(InvokeCommand).resolves({ StatusCode: 202 });
    process.env.TABLE_NAME = "tracker_store";
    process.env.AWS_LAMBDA_FUNCTION_NAME = "test-function";
  });

  describe("input validation", () => {
    test("throws when totalSegments is missing", async () => {
      await expect(
        handler({} as { totalSegments: number }, mockContext)
      ).rejects.toThrow("totalSegments must be a positive integer");
    });

    test("throws when totalSegments is not a positive integer", async () => {
      await expect(handler({ totalSegments: 0 }, mockContext)).rejects.toThrow(
        "totalSegments must be a positive integer"
      );
    });

    test("throws when TABLE_NAME is not set", async () => {
      delete process.env.TABLE_NAME;
      dynamoMock.on(ScanCommand).resolves({ Items: [] });

      await expect(handler({ totalSegments: 1 }, mockContext)).rejects.toThrow(
        'Environment variable "TABLE_NAME" is not set'
      );
    });
  });

  describe("scanning", () => {
    test("scans a single segment table to completion without self-invoking", async () => {
      dynamoMock
        .on(ScanCommand)
        .resolves({ Items: [cleanItem(), anomalousItem(), cleanItem()] });

      await handler({ totalSegments: 1 }, mockContext);

      expect(lambdaMock.commandCalls(InvokeCommand)).toHaveLength(0);
    });

    test("scans an empty table without self-invoking", async () => {
      dynamoMock.on(ScanCommand).resolves({ Items: [] });

      await handler({ totalSegments: 1 }, mockContext);

      expect(lambdaMock.commandCalls(InvokeCommand)).toHaveLength(0);
    });

    test("scans every segment in parallel", async () => {
      dynamoMock.on(ScanCommand).resolves({ Items: [cleanItem()] });

      await handler({ totalSegments: 3 }, mockContext);

      const calls = dynamoMock.commandCalls(ScanCommand);
      expect(calls).toHaveLength(3);
      expect(calls.map((c) => c.args[0].input.Segment).sort()).toEqual([
        0, 1, 2,
      ]);
      expect(calls[0].args[0].input.TotalSegments).toBe(3);
    });

    test("pages through multiple ScanCommand calls using ExclusiveStartKey", async () => {
      const lastKey = { dateForDeletion: { S: "2026-01-01" } };
      dynamoMock
        .on(ScanCommand)
        .resolvesOnce({ Items: [cleanItem()], LastEvaluatedKey: lastKey })
        .resolvesOnce({ Items: [cleanItem()] });

      await handler({ totalSegments: 1 }, mockContext);

      const calls = dynamoMock.commandCalls(ScanCommand);
      expect(calls).toHaveLength(2);
      expect(calls[1].args[0].input.ExclusiveStartKey).toEqual(lastKey);
    });

    test("does not project attributes, since every field must be available to validate", async () => {
      dynamoMock.on(ScanCommand).resolves({ Items: [] });

      await handler({ totalSegments: 1 }, mockContext);

      const input = dynamoMock.commandCalls(ScanCommand)[0].args[0].input;
      expect(input.ProjectionExpression).toBeUndefined();
    });
  });

  describe("wrapping up before the Lambda timeout", () => {
    test("stops scanning after the current page and self-invokes with the cursor", async () => {
      const lastKey = { dateForDeletion: { S: "2026-01-01" } };

      dynamoMock
        .on(ScanCommand)
        .resolvesOnce({ Items: [cleanItem()], LastEvaluatedKey: lastKey })
        .resolvesOnce({ Items: [cleanItem()] });

      await handler(
        { totalSegments: 1, deadlineMs: Date.now() - 1 },
        mockContext
      );

      expect(dynamoMock.commandCalls(ScanCommand)).toHaveLength(1);
      expect(lambdaMock.commandCalls(InvokeCommand)).toHaveLength(1);

      const invokeCall = lambdaMock.commandCalls(InvokeCommand)[0];
      expect(invokeCall.args[0].input.InvocationType).toBe("Event");
      const nextEvent = JSON.parse(
        Buffer.from(invokeCall.args[0].input.Payload! as Uint8Array).toString()
      );
      expect(nextEvent.cursors).toEqual([
        { segment: 0, lastEvaluatedKey: lastKey },
      ]);
      expect(nextEvent.invocation).toBe(2);
    });

    test("throws when async invoke returns a non-202 status", async () => {
      lambdaMock.reset();
      lambdaMock.on(InvokeCommand).resolves({ StatusCode: 500 });

      const lastKey = { dateForDeletion: { S: "2026-01-01" } };
      dynamoMock
        .on(ScanCommand)
        .resolvesOnce({ Items: [cleanItem()], LastEvaluatedKey: lastKey })
        .resolvesOnce({ Items: [cleanItem()] });

      await expect(
        handler({ totalSegments: 1, deadlineMs: Date.now() - 1 }, mockContext)
      ).rejects.toThrow("Async invoke returned status 500");
    });
  });

  describe("resuming across invocations", () => {
    test("resumes an incomplete segment from its cursor, only scanning that segment", async () => {
      dynamoMock.on(ScanCommand).resolves({ Items: [cleanItem()] });
      const resumeKey = { dateForDeletion: { S: "2026-01-01" } };

      await handler(
        {
          totalSegments: 2,
          cursors: [{ segment: 0, lastEvaluatedKey: resumeKey }],
          invocation: 2,
        },
        mockContext
      );

      const calls = dynamoMock.commandCalls(ScanCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input.Segment).toBe(0);
      expect(calls[0].args[0].input.ExclusiveStartKey).toEqual(resumeKey);
    });

    test("does not scan when every segment has already exhausted", async () => {
      dynamoMock.on(ScanCommand).resolves({ Items: [cleanItem()] });

      await handler(
        {
          totalSegments: 2,
          cursors: [],
          invocation: 2,
        },
        mockContext
      );

      expect(dynamoMock.commandCalls(ScanCommand)).toHaveLength(0);
      expect(lambdaMock.commandCalls(InvokeCommand)).toHaveLength(0);
    });

    test("scans a resumed segment from scratch when it has no lastEvaluatedKey", async () => {
      dynamoMock.on(ScanCommand).resolves({ Items: [cleanItem()] });

      await handler(
        {
          totalSegments: 2,
          cursors: [{ segment: 1 }],
          invocation: 2,
        },
        mockContext
      );

      const calls = dynamoMock.commandCalls(ScanCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input.Segment).toBe(1);
      expect(calls[0].args[0].input.ExclusiveStartKey).toBeUndefined();
    });
  });
});
