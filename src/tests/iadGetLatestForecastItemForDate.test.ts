import { describe, test, expect, beforeEach } from "vitest";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { getLatestForecastItemForDate } from "../common/iadGetLatestForecastItemForDate.js";

const dynamoMock = mockClient(DynamoDBDocumentClient);

const mockForecastItem = {
  dateForDeletion: "2026-06-20",
  forecastedAt: "2026-01-01T00:00:00.000Z",
  accountsToDelete: 42,
  ttl: 1234567890,
  iadQueryLogicHash: {
    hash: "abc123",
    algorithm: "sha256",
    generatedAt: "2026-01-01T00:00:00.000Z",
  },
};

describe("getLatestForecastItemForDate", () => {
  beforeEach(() => {
    dynamoMock.reset();
    process.env.FORECAST_TABLE_NAME = "forecast-table";
  });

  test("returns the first item from the query response", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [mockForecastItem] });

    const result = await getLatestForecastItemForDate("2026-06-20");
    expect(result).toEqual(mockForecastItem);
  });

  test("returns undefined when no items are found", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [] });

    const result = await getLatestForecastItemForDate("2026-06-20");
    expect(result).toBeUndefined();
  });

  test("returns undefined when Items is undefined", async () => {
    dynamoMock.on(QueryCommand).resolves({});

    const result = await getLatestForecastItemForDate("2026-06-20");
    expect(result).toBeUndefined();
  });

  test("queries with correct key condition and date", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [mockForecastItem] });

    await getLatestForecastItemForDate("2026-06-20");

    const [call] = dynamoMock.commandCalls(QueryCommand);
    expect(call.args[0].input.TableName).toBe("forecast-table");
    expect(call.args[0].input.KeyConditionExpression).toBe(
      "dateForDeletion = :date"
    );
    expect(call.args[0].input.ExpressionAttributeValues).toEqual({
      ":date": "2026-06-20",
    });
  });

  test("queries with ScanIndexForward false and Limit 1 to get the latest item", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [mockForecastItem] });

    await getLatestForecastItemForDate("2026-06-20");

    const [call] = dynamoMock.commandCalls(QueryCommand);
    expect(call.args[0].input.ScanIndexForward).toBe(false);
    expect(call.args[0].input.Limit).toBe(1);
  });

  test("throws on DynamoDB error", async () => {
    dynamoMock.on(QueryCommand).rejects(new Error("DynamoDB failure"));

    await expect(getLatestForecastItemForDate("2026-06-20")).rejects.toThrow(
      "DynamoDB failure"
    );
  });
});
