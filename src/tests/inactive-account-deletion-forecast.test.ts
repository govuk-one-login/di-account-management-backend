import { vi, describe, test, expect, beforeEach, afterEach } from "vitest";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient, DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import {
  buildDates,
  countAccountsForDate,
  handler,
} from "../inactive-account-deletion-forecast.js";

const dynamoDocumentMock = mockClient(DynamoDBDocumentClient);
const dynamoMock = mockClient(DynamoDBClient);

const mockMetrics = vi.hoisted(() => ({
  publishStoredMetrics: vi.fn(),
  addMetric: vi.fn(),
}));

const mockInitMetrics = vi.hoisted(() => vi.fn(() => mockMetrics));

vi.mock("../common/metrics.js", () => ({
  initMetrics: mockInitMetrics,
}));

describe("buildDates", () => {
  test("returns the correct number of dates starting from tomorrow", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const dates = buildDates(new Date(), 3);
    expect(dates).toEqual(["2026-01-02", "2026-01-03", "2026-01-04"]);

    vi.useRealTimers();
  });

  test("returns 180 dates for the full forecast window", () => {
    const dates = buildDates(new Date(), 180);
    expect(dates).toHaveLength(180);
  });
});

describe("countAccountsForDate", () => {
  beforeEach(() => {
    dynamoDocumentMock.reset();
  });

  test("returns the count from a single page", async () => {
    dynamoDocumentMock.on(QueryCommand).resolves({ Count: 42 });

    const count = await countAccountsForDate("my-table", "2026-06-01");
    expect(count).toBe(42);
  });

  test("accumulates counts across paginated responses", async () => {
    dynamoDocumentMock
      .on(QueryCommand)
      .resolvesOnce({
        Count: 100,
        LastEvaluatedKey: {
          dateForDeletion: "2026-06-01",
          commonSubjectId: "x",
        },
      })
      .resolvesOnce({ Count: 50 });

    const count = await countAccountsForDate("my-table", "2026-06-01");
    expect(count).toBe(150);
    expect(dynamoDocumentMock.commandCalls(QueryCommand)).toHaveLength(2);
  });

  test("returns 0 when Count is undefined", async () => {
    dynamoDocumentMock.on(QueryCommand).resolves({});

    const count = await countAccountsForDate("my-table", "2026-06-01");
    expect(count).toBe(0);
  });

  test("throws on DynamoDB error", async () => {
    dynamoDocumentMock.on(QueryCommand).rejects(new Error("DynamoDB failure"));

    await expect(
      countAccountsForDate("my-table", "2026-06-01")
    ).rejects.toThrow("DynamoDB failure");
  });
});

describe("handler", () => {
  beforeEach(() => {
    dynamoDocumentMock.reset();
    process.env.TABLE_NAME = "inactive-accounts-table";
    process.env.FORECAST_TABLE_NAME = "forecast-table";
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.TABLE_NAME;
    delete process.env.FORECAST_TABLE_NAME;
  });

  test("queries 180 dates, writes forecast records, and emits InactiveAccountTrackerRecordCount metricc", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    dynamoMock.on(DescribeTableCommand).resolves({
      Table: { ItemCount: 4500 }
    });
    dynamoDocumentMock.on(QueryCommand).resolves({ Count: 10 });
    dynamoDocumentMock.on(PutCommand).resolves({});

    await handler();

    expect(dynamoMock).toHaveReceivedCommandWith(DescribeTableCommand, {
      TableName: "inactive-accounts-table"});
    expect(dynamoMock.commandCalls(DescribeTableCommand)).toHaveLength(1);

    expect(mockMetrics.addMetric).toHaveBeenCalledWith(
      "InactiveAccountTrackerRecordCount",
      "Count",
      4500
    );
    expect(mockMetrics.publishStoredMetrics).toHaveBeenCalledTimes(1);

    expect(dynamoDocumentMock.commandCalls(QueryCommand)).toHaveLength(180);
    expect(dynamoDocumentMock.commandCalls(PutCommand)).toHaveLength(180);

    vi.useRealTimers();
  });


  test("throws when TABLE_NAME is not set", async () => {
    delete process.env.TABLE_NAME;

    await expect(handler()).rejects.toThrow(
      'Environment variable "TABLE_NAME" is not set.'
    );
  });

  test("throws when FORECAST_TABLE_NAME is not set", async () => {
    delete process.env.FORECAST_TABLE_NAME;

    await expect(handler()).rejects.toThrow(
      'Environment variable "FORECAST_TABLE_NAME" is not set.'
    );
  });

  test("throws loudly on DynamoDB error", async () => {
    dynamoDocumentMock.on(QueryCommand).rejects(new Error("DynamoDB down"));

    await expect(handler()).rejects.toThrow("DynamoDB down");
  });
});
