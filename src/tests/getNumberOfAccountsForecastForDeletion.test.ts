import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { getNumberOfAccountsForecastForDeletion } from "../common/getNumberOfAccountsForecastForDeletion.js";

const dynamoMock = mockClient(DynamoDBDocumentClient);

const TABLE_NAME = "forecast-table";
const TEST_DATE = "2026-06-17";

describe("getNumberOfAccountsForecastForDeletion", () => {
  beforeEach(() => {
    process.env.FORECAST_TABLE_NAME = TABLE_NAME;
    dynamoMock.reset();
  });

  afterEach(() => {
    delete process.env.FORECAST_TABLE_NAME;
  });

  test("returns accountsToDelete when item exists", async () => {
    dynamoMock
      .on(GetCommand)
      .resolves({ Item: { dateForDeletion: TEST_DATE, accountsToDelete: 42 } });

    expect(await getNumberOfAccountsForecastForDeletion(TEST_DATE)).toBe(42);
  });

  test("returns undefined when item does not exist", async () => {
    dynamoMock.on(GetCommand).resolves({ Item: undefined });

    expect(
      await getNumberOfAccountsForecastForDeletion(TEST_DATE)
    ).toBeUndefined();
  });

  test("returns undefined when accountsToDelete is missing from item", async () => {
    dynamoMock
      .on(GetCommand)
      .resolves({ Item: { dateForDeletion: TEST_DATE } });

    expect(
      await getNumberOfAccountsForecastForDeletion(TEST_DATE)
    ).toBeUndefined();
  });

  test("queries with correct parameters", async () => {
    dynamoMock.on(GetCommand).resolves({ Item: undefined });

    await getNumberOfAccountsForecastForDeletion(TEST_DATE);

    expect(dynamoMock).toHaveReceivedCommandWith(GetCommand, {
      TableName: TABLE_NAME,
      Key: { dateForDeletion: TEST_DATE },
      ConsistentRead: true,
    });
  });

  test("throws when FORECAST_TABLE_NAME is not set", async () => {
    delete process.env.FORECAST_TABLE_NAME;

    await expect(
      getNumberOfAccountsForecastForDeletion(TEST_DATE)
    ).rejects.toThrow('Environment variable "FORECAST_TABLE_NAME" is not set.');
  });
});
