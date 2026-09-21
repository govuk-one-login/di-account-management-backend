import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { getNumberOfAccountsForecastForDeletion } from "../../common/iadGuards/getNumberOfAccountsForecastForDeletion.js";

const dynamoDocMock = mockClient(DynamoDBDocumentClient);

describe("getNumberOfAccountsDueForDeletion", () => {
  beforeEach(() => {
    dynamoDocMock.reset();
    process.env.FORECAST_TABLE_NAME = "forecast-table";
  });

  afterEach(() => {
    delete process.env.FORECAST_TABLE_NAME;
  });

  test("returns accountsToDelete when item exists", async () => {
    dynamoDocMock.on(GetCommand).resolves({ Item: { accountsToDelete: 42 } });

    const result = await getNumberOfAccountsForecastForDeletion("2026-03-15");

    expect(result).toBe(42);
    expect(dynamoDocMock).toHaveReceivedCommandWith(GetCommand, {
      TableName: "forecast-table",
      Key: { dateForDeletion: "2026-03-15" },
    });
  });

  test("returns undefined when no item exists for the date", async () => {
    dynamoDocMock.on(GetCommand).resolves({ Item: undefined });

    const result = await getNumberOfAccountsForecastForDeletion("2026-03-15");

    expect(result).toBeUndefined();
  });

  test("throws when FORECAST_TABLE_NAME is not set", async () => {
    delete process.env.FORECAST_TABLE_NAME;

    await expect(
      getNumberOfAccountsForecastForDeletion("2026-03-15")
    ).rejects.toThrow('Environment variable "FORECAST_TABLE_NAME" is not set.');
  });

  test("throws on DynamoDB error", async () => {
    dynamoDocMock.on(GetCommand).rejects(new Error("DynamoDB down"));

    await expect(
      getNumberOfAccountsForecastForDeletion("2026-03-15")
    ).rejects.toThrow("DynamoDB down");
  });
});
