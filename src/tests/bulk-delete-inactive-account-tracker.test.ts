import { vi, describe, test, expect, beforeEach, afterEach } from "vitest";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { Context } from "aws-lambda";
import { handler } from "../bulk-delete-inactive-account-tracker.js";

const dynamoMock = mockClient(DynamoDBDocumentClient);

const mockContext = (remainingMs = 900_000): Context =>
  ({
    getRemainingTimeInMillis: () => remainingMs,
  }) as unknown as Context;

const item1 = { dateForDeletion: "2024-01-01", commonSubjectId: "subject-1" };
const item2 = { dateForDeletion: "2024-01-02", commonSubjectId: "subject-2" };

describe("handler", () => {
  beforeEach(() => {
    dynamoMock.reset();
    process.env.TABLE_NAME = "test-table";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("deletes all items when table fits in one page", async () => {
    dynamoMock
      .on(ScanCommand)
      .resolvesOnce({ Items: [item1, item2], LastEvaluatedKey: undefined });

    const result = await handler({}, mockContext());

    expect(result.deleted).toBe(2);
    expect(result.lastEvaluatedKey).toBeUndefined();
    expect(dynamoMock).toHaveReceivedCommandWith(BatchWriteCommand, {
      RequestItems: {
        "test-table": [
          { DeleteRequest: { Key: item1 } },
          { DeleteRequest: { Key: item2 } },
        ],
      },
    });
  });

  test("paginates across multiple pages and deletes all items", async () => {
    dynamoMock
      .on(ScanCommand)
      .resolvesOnce({ Items: [item1], LastEvaluatedKey: item1 })
      .resolvesOnce({ Items: [item2], LastEvaluatedKey: undefined });

    const result = await handler({}, mockContext());

    expect(result.deleted).toBe(2);
    expect(result.lastEvaluatedKey).toBeUndefined();
    expect(dynamoMock.commandCalls(ScanCommand).length).toBe(2);
    expect(dynamoMock.commandCalls(BatchWriteCommand).length).toBe(2);
  });

  test("passes startKey from event as ExclusiveStartKey on first scan", async () => {
    dynamoMock
      .on(ScanCommand)
      .resolvesOnce({ Items: [item2], LastEvaluatedKey: undefined });

    await handler({ startKey: item1 }, mockContext());

    expect(dynamoMock).toHaveReceivedCommandWith(ScanCommand, {
      ExclusiveStartKey: item1,
    });
  });

  test("stops and returns lastEvaluatedKey when approaching timeout", async () => {
    dynamoMock
      .on(ScanCommand)
      .resolvesOnce({ Items: [item1], LastEvaluatedKey: item1 });

    const result = await handler({}, mockContext(9_000));

    expect(result.deleted).toBe(1);
    expect(result.lastEvaluatedKey).toEqual(item1);
    expect(dynamoMock.commandCalls(ScanCommand).length).toBe(1);
  });

  test("does not call BatchWriteCommand when scan returns no items", async () => {
    dynamoMock
      .on(ScanCommand)
      .resolvesOnce({ Items: [], LastEvaluatedKey: undefined });

    const result = await handler({}, mockContext());

    expect(result.deleted).toBe(0);
    expect(dynamoMock.commandCalls(BatchWriteCommand).length).toBe(0);
  });

  test("throws when DynamoDB scan fails", async () => {
    dynamoMock.on(ScanCommand).rejects(new Error("DynamoDB error"));

    await expect(handler({}, mockContext())).rejects.toThrow("DynamoDB error");
  });

  test("throws when BatchWriteCommand fails", async () => {
    dynamoMock
      .on(ScanCommand)
      .resolvesOnce({ Items: [item1], LastEvaluatedKey: undefined });
    dynamoMock.on(BatchWriteCommand).rejects(new Error("Write error"));

    await expect(handler({}, mockContext())).rejects.toThrow("Write error");
  });
});
