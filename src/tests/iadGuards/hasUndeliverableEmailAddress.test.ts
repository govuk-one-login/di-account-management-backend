import { vi, describe, test, expect, beforeEach } from "vitest";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { hasUndeliverableEmailAddress } from "../../common/iadGuards/hasUndeliverableEmailAddress.js";
import "aws-sdk-client-mock-vitest";

const dynamoMock = mockClient(DynamoDBDocumentClient);

describe("hasUndeliverableEmailAddress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dynamoMock.reset();
    process.env.INACTIVE_ACCOUNT_TRACKER_TABLE_NAME = "test-inactive-account-table";
  });

  test("returns continue: 'Continue' when record has hasUndeliverableEmailAddress: false", async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [{ commonSubjectId: "user-123", hasUndeliverableEmailAddress: false }]
    });

    const result = await hasUndeliverableEmailAddress("user-123");

    expect(result).toEqual({ continue: 'Continue', guardName: "undeliverableEmailAddress" });
  });

  test("returns continue: 'ContinueWithoutPerformingActions' when record exists with hasUndeliverableEmailAddress: true", async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [{ commonSubjectId: "user-123", hasUndeliverableEmailAddress: true }]
    });

    const result = await hasUndeliverableEmailAddress("user-123");

    expect(result).toEqual({ continue: 'ContinueWithoutPerformingActions', guardName: "undeliverableEmailAddress" });
  });

  test("returns continue: 'Continue' when Items array is undefined", async () => {
    dynamoMock.on(QueryCommand).resolves({});

    const result = await hasUndeliverableEmailAddress("user-123");

    expect(result).toEqual({ continue: 'Continue', guardName: "undeliverableEmailAddress" });
  });

  test("queries the correct table with the correct parameters", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [] });

    await hasUndeliverableEmailAddress("user-456");

    expect(dynamoMock).toHaveReceivedCommandWith(QueryCommand, {
      TableName: "test-inactive-account-table",
      IndexName: "CommonSubjectIdIndex",
      KeyConditionExpression: "commonSubjectId = :id",
      ExpressionAttributeValues: {
        ":id": "user-456"
      }
    });
  });

  test("propagates errors from DynamoDB", async () => {
    dynamoMock.on(QueryCommand).rejects(new Error("DynamoDB error"));

    await expect(hasUndeliverableEmailAddress("user-123")).rejects.toThrow("DynamoDB error");
  });
});
