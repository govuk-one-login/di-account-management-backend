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

  test("returns guardActivated: false when no recent activity exists", async () => {
    dynamoMock.on(QueryCommand).resolves({ Count: 0 });

    const result = await hasRecentActivityLogEntry("user-123");

    expect(result).toEqual({
      guardActivated: false,
      guardName: "HomeUserActivityLog",
    });
  });

  test("returns guardActivated: true when recent activity exists", async () => {
    dynamoMock.on(QueryCommand).resolves({ Count: 3 });

    const result = await hasRecentActivityLogEntry("user-123");

    expect(result).toEqual({
      guardActivated: true,
      guardName: "HomeUserActivityLog",
    });
  });

  test("returns guardActivated: false when Count is undefined", async () => {
    dynamoMock.on(QueryCommand).resolves({});

    const result = await hasRecentActivityLogEntry("user-123");

    expect(result).toEqual({
      guardActivated: false,
      guardName: "HomeUserActivityLog",
    });
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
    const fixedNow = 1700000000000;
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);

    dynamoMock.on(QueryCommand).resolves({ Count: 0 });
    await hasRecentActivityLogEntry("user-123");

    vi.useRealTimers();

    const fiveYearsMinus30DaysS = 5 * 365 * 24 * 60 * 60 - 30 * 24 * 60 * 60;
    const call = dynamoMock.commandCalls(QueryCommand)[0];
    const cutoff = call.args[0].input.ExpressionAttributeValues![
      ":cutoff"
    ] as number;

    expect(cutoff).toBe(fixedNow / 1000 - fiveYearsMinus30DaysS);
  });

  test("propagates errors from DynamoDB", async () => {
    dynamoMock.on(QueryCommand).rejects(new Error("DynamoDB error"));

    await expect(hasRecentActivityLogEntry("user-123")).rejects.toThrow(
      "DynamoDB error"
    );
  });
});
