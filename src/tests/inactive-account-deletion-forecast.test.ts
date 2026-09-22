import { vi, describe, test, expect, beforeEach, afterEach } from "vitest";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient, DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { Context } from "aws-lambda";
import { buildDates, handler } from "../inactive-account-deletion-forecast.js";

const dynamoDocumentMock = mockClient(DynamoDBDocumentClient);
const dynamoMock = mockClient(DynamoDBClient);

const mockContext = (remainingMs = 900_000): Context =>
  ({
    getRemainingTimeInMillis: () => remainingMs,
  }) as unknown as Context;

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

  test("returns 1825 dates for the full forecast window", () => {
    const dates = buildDates(new Date(), 5 * 365);
    expect(dates).toHaveLength(1825);
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

  test("queries 1825 dates, writes forecast records, logs per date, and emits InactiveAccountTrackerRecordCount metric", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    dynamoMock.on(DescribeTableCommand).resolves({
      Table: { ItemCount: 4500 },
    });
    dynamoDocumentMock
      .on(QueryCommand)
      .resolves({ Count: 10, ScannedCount: 10 });
    dynamoDocumentMock.on(PutCommand).resolves({});

    await handler({}, mockContext());

    expect(dynamoMock).toHaveReceivedCommandWith(DescribeTableCommand, {
      TableName: "inactive-accounts-table",
    });
    expect(dynamoMock.commandCalls(DescribeTableCommand)).toHaveLength(1);

    expect(mockMetrics.addMetric).toHaveBeenCalledWith(
      "InactiveAccountTrackerRecordCount",
      "Count",
      4500
    );
    expect(mockMetrics.publishStoredMetrics).toHaveBeenCalledTimes(1);

    expect(dynamoDocumentMock.commandCalls(QueryCommand)).toHaveLength(1825);
    expect(dynamoDocumentMock.commandCalls(PutCommand)).toHaveLength(1825);

    vi.useRealTimers();
  });

  test.each([
    {
      label: "stops on the first batch",
      remainingTimesMs: [5_000],
      expectedProcessed: 20,
    },
    {
      label: "continues past the first check and stops on a later batch",
      remainingTimesMs: [900_000, 600_000, 300_000, 5_000],
      expectedProcessed: 80,
    },
  ])(
    "stops once time is nearly up, forecasting only the soonest dates ($label)",
    async ({ remainingTimesMs, expectedProcessed }) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

      dynamoMock.on(DescribeTableCommand).resolves({ Table: { ItemCount: 0 } });
      dynamoDocumentMock
        .on(QueryCommand)
        .resolves({ Count: 10, ScannedCount: 10 });
      dynamoDocumentMock.on(PutCommand).resolves({});

      let call = 0;
      const context = {
        getRemainingTimeInMillis: () => remainingTimesMs[call++] ?? 5_000,
      } as unknown as Context;

      await handler({}, context);

      expect(dynamoDocumentMock.commandCalls(QueryCommand)).toHaveLength(
        expectedProcessed
      );
      expect(dynamoDocumentMock.commandCalls(PutCommand)).toHaveLength(
        expectedProcessed
      );

      const forecastedDates = dynamoDocumentMock
        .commandCalls(PutCommand)
        .map((putCall) => putCall.args[0].input.Item?.dateForDeletion);
      expect(forecastedDates).toEqual(
        buildDates(new Date("2026-01-01T00:00:00.000Z"), expectedProcessed)
      );

      vi.useRealTimers();
    }
  );

  test("throws when TABLE_NAME is not set", async () => {
    delete process.env.TABLE_NAME;

    await expect(handler({}, mockContext())).rejects.toThrow(
      'Environment variable "TABLE_NAME" is not set.'
    );
  });

  test("throws when FORECAST_TABLE_NAME is not set", async () => {
    delete process.env.FORECAST_TABLE_NAME;

    await expect(handler({}, mockContext())).rejects.toThrow(
      'Environment variable "FORECAST_TABLE_NAME" is not set.'
    );
  });

  test("throws loudly on DynamoDB error", async () => {
    dynamoDocumentMock.on(QueryCommand).rejects(new Error("DynamoDB down"));

    await expect(handler({}, mockContext())).rejects.toThrow("DynamoDB down");
  });
});
