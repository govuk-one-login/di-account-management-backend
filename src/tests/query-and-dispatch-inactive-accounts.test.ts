import { vi, describe, test, expect, beforeEach, afterEach } from "vitest";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { SQSClient, SendMessageBatchCommand } from "@aws-sdk/client-sqs";
import { mockClient } from "aws-sdk-client-mock";
import {
  handler,
  validateEvent,
  calculateTargetDate,
} from "../query-and-dispatch-inactive-accounts.js";
import type { Context } from "aws-lambda";

const dynamoMock = mockClient(DynamoDBDocumentClient);
const sqsMock = mockClient(SQSClient);

const mockRecord = {
  dateForDeletion: "2026-06-20",
  commonSubjectId: "user-1",
  publicSubjectId: "public-subject-1",
  emailAddress: "test@example.com",
  userLastActive: "2021-06-20T00:00:00.000Z",
  userLastActiveSource: "AUTH_AUTH_CODE_ISSUED",
  userLastActiveUpdated: "2026-01-01T00:00:00.000Z",
  emailAddressSource: "AUTH_AUTH_CODE_ISSUED",
  emailAddressLastUpdated: "2026-01-01T00:00:00.000Z",
  status: "pending",
  statusLastUpdated: "2026-01-01T00:00:00.000Z",
  hasSetupMfa: false,
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

    expect(sqsMock.commandCalls(SendMessageBatchCommand)).toHaveLength(0);
  });

  test("throws on invalid processName", async () => {
    await expect(
      handler({ processName: "unknown" }, {} as Context)
    ).rejects.toThrow("Unknown processName: unknown");
  });

  test("logs error and continues when batch send throws", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [mockRecord] });
    sqsMock.on(SendMessageBatchCommand).rejects(new Error("SQS failure"));

    await expect(
      handler({ processName: "Warning30Day" }, {} as Context)
    ).resolves.toBeUndefined();

    expect(sqsMock.commandCalls(SendMessageBatchCommand)).toHaveLength(1);
  });

  test("logs partial failures returned in batch response", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [mockRecord] });
    sqsMock.on(SendMessageBatchCommand).resolves({
      Failed: [{ Id: "0", Code: "InternalError", SenderFault: false }],
      Successful: [],
    });

    await expect(
      handler({ processName: "Warning30Day" }, {} as Context)
    ).resolves.toBeUndefined();

    expect(sqsMock.commandCalls(SendMessageBatchCommand)).toHaveLength(1);
  });

  test("when manualTestOnly is true, only dispatches records with userLastActiveSource MANUAL_TEST", async () => {
    const manualRecord = { ...mockRecord, userLastActiveSource: "MANUAL_TEST" };
    dynamoMock.on(QueryCommand).resolves({ Items: [mockRecord, manualRecord] });
    sqsMock.on(SendMessageBatchCommand).resolves({ Successful: [], Failed: [] });

    await handler({ processName: "Warning30Day", manualTestOnly: true }, {} as Context);

    expect(sqsMock).toHaveReceivedCommandWith(SendMessageBatchCommand, {
      Entries: [expect.objectContaining({ MessageBody: JSON.stringify({ ...manualRecord, processName: "Warning30Day" }) })],
    });
    expect(sqsMock.commandCalls(SendMessageBatchCommand)[0].args[0].input.Entries).toHaveLength(1);
  });

  test("when manualTestOnly is false, dispatches all eligible records regardless of userLastActiveSource", async () => {
    const manualRecord = { ...mockRecord, commonSubjectId: "user-2", userLastActiveSource: "MANUAL_TEST" };
    dynamoMock.on(QueryCommand).resolves({ Items: [mockRecord, manualRecord] });
    sqsMock.on(SendMessageBatchCommand).resolves({ Successful: [], Failed: [] });

    await handler({ processName: "Warning30Day", manualTestOnly: false }, {} as Context);

    expect(sqsMock.commandCalls(SendMessageBatchCommand)[0].args[0].input.Entries).toHaveLength(2);
  });
});
