import { vi, describe, test, expect, beforeEach, afterEach } from "vitest";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { mockClient } from "aws-sdk-client-mock";
import {
  handler,
  validateEvent,
  calculateTargetDate,
  queryAccountsByDate,
} from "../query-and-dispatch-inactive-accounts.js";
import type { Context } from "aws-lambda";

const dynamoMock = mockClient(DynamoDBDocumentClient);
const sqsMock = mockClient(SQSClient);

const mockRecord = {
  dateForDeletion: "2026-06-20",
  commonSubjectId: "user-1",
  emailAddress: "test@example.com",
  userLastActive: "2021-06-20T00:00:00.000Z",
  status: "pending",
  statusLastUpdated: "2026-01-01T00:00:00.000Z",
};

describe("validateEvent", () => {
  test("throws when processName is unknown", () => {
    expect(() => validateEvent({ processName: "unknown" })).toThrow(
      "Unknown processName: unknown"
    );
  });

  test("throws when processName is empty", () => {
    expect(() => validateEvent({ processName: "" })).toThrow(
      "Unknown processName:"
    );
  });

  test("does not throw for valid input", () => {
    expect(() => validateEvent({ processName: "Warning30Day" })).not.toThrow();
  });
});

describe("calculateTargetDate", () => {
  test("returns date in YYYY-MM-DD format offset by daysToDeletion", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-17T12:00:00.000Z"));

    expect(calculateTargetDate(3)).toBe("2026-06-20");
    expect(calculateTargetDate(0)).toBe("2026-06-17");
    expect(calculateTargetDate(-3)).toBe("2026-06-14");

    vi.useRealTimers();
  });
});

describe("queryAccountsByDate", () => {
  beforeEach(() => {
    dynamoMock.reset();
  });

  test("paginates through all results", async () => {
    dynamoMock
      .on(QueryCommand)
      .resolvesOnce({
        Items: [mockRecord],
        LastEvaluatedKey: { dateForDeletion: "2026-06-20", commonSubjectId: "user-1" },
      })
      .resolvesOnce({
        Items: [{ ...mockRecord, commonSubjectId: "user-2" }],
        LastEvaluatedKey: undefined,
      });

    const results = await queryAccountsByDate("table", "2026-06-20");
    expect(results).toHaveLength(2);
    expect(dynamoMock.commandCalls(QueryCommand)).toHaveLength(2);
  });

  test("returns empty array when no results", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [] });

    const results = await queryAccountsByDate("table", "2026-06-20");
    expect(results).toHaveLength(0);
  });
});

describe("handler", () => {
  beforeEach(() => {
    dynamoMock.reset();
    sqsMock.reset();
    process.env.TABLE_NAME = "inactive-accounts-table";
    process.env.WARNING_30_DAY_NOTIFICATION_QUEUE_URL = "https://sqs.eu-west-2.amazonaws.com/123/queue";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("does not send messages when no records found", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [] });

    await handler({ processName: "Warning30Day" }, {} as Context);

    expect(sqsMock.commandCalls(SendMessageCommand)).toHaveLength(0);
  });

  test("throws on invalid processName", async () => {
    await expect(
      handler({ processName: "unknown" }, {} as Context)
    ).rejects.toThrow("Unknown processName: unknown");
  });

  test("propagates SQS errors", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [mockRecord] });
    sqsMock.on(SendMessageCommand).rejects(new Error("SQS failure"));

    await expect(
      handler({ processName: "Warning30Day" }, {} as Context)
    ).rejects.toThrow("SQS failure");
  });
});
