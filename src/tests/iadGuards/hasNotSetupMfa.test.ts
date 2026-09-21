import { vi, describe, test, expect, beforeEach } from "vitest";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { hasNotSetupMfa } from "../../common/iadGuards/hasNotSetupMfa.js";
import "aws-sdk-client-mock-vitest";

const dynamoMock = mockClient(DynamoDBDocumentClient);

describe("hasNotSetupMfa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dynamoMock.reset();
    process.env.INACTIVE_ACCOUNT_TRACKER_TABLE_NAME = "test-inactive-account-table";
  });

  test("returns guardActivated: false when record has hasSetupMfa: true", async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [{ commonSubjectId: "user-123", hasSetupMfa: true }]
    });

    const result = await hasNotSetupMfa("user-123");

    expect(result).toEqual({ guardActivated: false, guardName: "hasNotSetupMfa" });
  });

  test("returns guardActivated: true when record exists with hasSetupMfa: false", async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [{ commonSubjectId: "user-123", hasSetupMfa: false }]
    });

    const result = await hasNotSetupMfa("user-123");

    expect(result).toEqual({ guardActivated: true, guardName: "hasNotSetupMfa" });
  });

  test("returns guardActivated: false when Items array is undefined", async () => {
    dynamoMock.on(QueryCommand).resolves({});

    const result = await hasNotSetupMfa("user-123");

    expect(result).toEqual({ guardActivated: false, guardName: "hasNotSetupMfa" });
  });

  test("returns guardActivated: false when record has no hasSetupMfa attribute", async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [{ commonSubjectId: "user-123" }]
    });

    const result = await hasNotSetupMfa("user-123");

    expect(result).toEqual({ guardActivated: false, guardName: "hasNotSetupMfa" });
  });

  test("queries the correct table with the correct parameters", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [] });

    await hasNotSetupMfa("user-456");

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

    await expect(hasNotSetupMfa("user-123")).rejects.toThrow("DynamoDB error");
  });
});
