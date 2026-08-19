import { vi, describe, test, expect, beforeEach } from "vitest";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import "aws-sdk-client-mock-vitest";

const dynamoMock = mockClient(DynamoDBDocumentClient);

import { hasRecentActivityLogEntry } from "../../common/iadGuards/hasRecentActivityLogEntry.js";

describe("hasRecentActivityLogEntry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dynamoMock.reset();
    process.env.ACTIVITY_LOG_TABLE_NAME = "test-activity-log-table";
  });

  test("returns continue: true when no recent activity exists", async () => {
    dynamoMock.on(QueryCommand).resolves({ Count: 0 });

    const result = await hasRecentActivityLogEntry("user-123");

    expect(result).toEqual({ continue: true, guardName: "HomeUserActivityLog" });
  });

  test("returns continue: false when recent activity exists", async () => {
    dynamoMock.on(QueryCommand).resolves({ Count: 3 });

    const result = await hasRecentActivityLogEntry("user-123");

    expect(result).toEqual({ continue: false, guardName: "HomeUserActivityLog" });
  });

  test("returns continue: true when Count is undefined", async () => {
    dynamoMock.on(QueryCommand).resolves({});

    const result = await hasRecentActivityLogEntry("user-123");

    expect(result).toEqual({ continue: true, guardName: "HomeUserActivityLog" });
  });

  test("queries the correct table with the correct user_id", async () => {
    dynamoMock.on(QueryCommand).resolves({ Count: 0 });

    await hasRecentActivityLogEntry("user-456");

    expect(dynamoMock).toHaveReceivedCommandWith(QueryCommand, {
      TableName: "test-activity-log-table",
      KeyConditionExpression: "user_id = :uid",
      FilterExpression: "#ts >= :cutoff",
      ExpressionAttributeNames: { "#ts": "timestamp" },
      ExpressionAttributeValues: {
        ":uid": "user-456",
        ":cutoff": expect.any(Number),
      },
      Select: "COUNT",
    });
  });

  test("uses a cutoff timestamp within the expected range", async () => {
    dynamoMock.on(QueryCommand).resolves({ Count: 0 });

    const before = Date.now();
    await hasRecentActivityLogEntry("user-123");
    const after = Date.now();

    const fiveYearsMinus30DaysMs = (5 * 365 * 24 * 60 * 60 - 30 * 24 * 60 * 60) * 1000;
    const call = dynamoMock.commandCalls(QueryCommand)[0];
    const cutoff = call.args[0].input.ExpressionAttributeValues![":cutoff"] as number;

    expect(cutoff).toBeGreaterThanOrEqual(before - fiveYearsMinus30DaysMs);
    expect(cutoff).toBeLessThanOrEqual(after - fiveYearsMinus30DaysMs);
  });

  test("propagates errors from DynamoDB", async () => {
    dynamoMock.on(QueryCommand).rejects(new Error("DynamoDB error"));

    await expect(hasRecentActivityLogEntry("user-123")).rejects.toThrow("DynamoDB error");
  });
});
