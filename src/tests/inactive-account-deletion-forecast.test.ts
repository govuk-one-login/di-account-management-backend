import { vi, describe, test, expect, beforeEach, afterEach } from "vitest";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient, DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { Logger } from "@aws-lambda-powertools/logger";
import { Context } from "aws-lambda";
import { buildDates, handler } from "../inactive-account-deletion-forecast.js";

const dynamoDocumentMock = mockClient(DynamoDBDocumentClient);
const dynamoMock = mockClient(DynamoDBClient);

const SKIP_EMAIL_REASON_BREAKDOWN_DAYS = 90;
const FORECAST_DAYS = 1825;
const EXPECTED_QUERY_COUNT =
  SKIP_EMAIL_REASON_BREAKDOWN_DAYS * 2 +
  (FORECAST_DAYS - SKIP_EMAIL_REASON_BREAKDOWN_DAYS);

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

vi.mock("../common/iad-query-logic-hash.json", () => ({
  default: {
    hash: "test-hash",
    algorithm: "sha256",
    generatedAt: "1970-01-01T00:00:00.000Z",
  },
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
    vi.restoreAllMocks();
    delete process.env.TABLE_NAME;
    delete process.env.FORECAST_TABLE_NAME;
  });

  test("queries all dates, writes forecast records, logs per date, and emits InactiveAccountTrackerRecordCount metric", async () => {
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

    expect(dynamoDocumentMock.commandCalls(QueryCommand)).toHaveLength(
      EXPECTED_QUERY_COUNT
    );
    expect(dynamoDocumentMock.commandCalls(PutCommand)).toHaveLength(
      FORECAST_DAYS
    );

    vi.useRealTimers();
  });

  test("logs willSendWarningEmails, skippedNoMfa and skippedUndeliverable for a date within the 90-day window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const infoSpy = vi.spyOn(Logger.prototype, "info");

    dynamoMock.on(DescribeTableCommand).resolves({ Table: { ItemCount: 0 } });
    dynamoDocumentMock
      .on(QueryCommand, { FilterExpression: "hasSetupMfa = :val" })
      .resolves({ Count: 3, ScannedCount: 10 });
    dynamoDocumentMock
      .on(QueryCommand, {
        FilterExpression: "hasUndeliverableEmailAddress = :val",
      })
      .resolves({ Count: 2, ScannedCount: 10 });
    dynamoDocumentMock.on(PutCommand).resolves({});

    const context = {
      getRemainingTimeInMillis: () => 900_000,
    } as unknown as Context;

    // Only need the first batch to have processed; time runs out immediately after.
    let remainingCalls = 0;
    context.getRemainingTimeInMillis = () =>
      remainingCalls++ === 0 ? 900_000 : 5_000;

    await handler({}, context);

    expect(infoSpy).toHaveBeenCalledWith(
      "Deletion forecast",
      expect.objectContaining({
        dateForDeletion: "2026-01-02",
        accountsToDelete: 10,
        willSendWarningEmails: 5,
        skippedNoMfa: 3,
        skippedUndeliverable: 2,
      })
    );

    vi.useRealTimers();
  });

  test("logs only accountsToDelete for a date beyond the 90-day window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const infoSpy = vi.spyOn(Logger.prototype, "info");

    dynamoMock.on(DescribeTableCommand).resolves({ Table: { ItemCount: 0 } });
    dynamoDocumentMock.on(QueryCommand).resolves({ Count: 8 });
    dynamoDocumentMock.on(PutCommand).resolves({});

    await handler({}, mockContext());

    const dateBeyondWindow = buildDates(
      new Date("2026-01-01T00:00:00.000Z"),
      100
    )[99];

    expect(infoSpy).toHaveBeenCalledWith("Deletion forecast", {
      dateForDeletion: dateBeyondWindow,
      accountsToDelete: 8,
    });

    vi.useRealTimers();
  });

  test("logs skippedVerifyMigrated for the 27 October date instead of a per-record breakdown", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T00:00:00.000Z"));

    const infoSpy = vi.spyOn(Logger.prototype, "info");

    dynamoMock.on(DescribeTableCommand).resolves({ Table: { ItemCount: 0 } });
    dynamoDocumentMock.on(QueryCommand).resolves({ Count: 0 });
    dynamoDocumentMock
      .on(QueryCommand, { FilterExpression: "hasSetupMfa = :val" })
      .resolves({ Count: 0, ScannedCount: 20 });
    dynamoDocumentMock
      .on(QueryCommand, {
        FilterExpression: "hasUndeliverableEmailAddress = :val",
      })
      .resolves({ Count: 0, ScannedCount: 20 });
    dynamoDocumentMock.on(PutCommand).resolves({});

    await handler({}, mockContext());

    expect(infoSpy).toHaveBeenCalledWith("Deletion forecast", {
      dateForDeletion: "2026-10-27",
      accountsToDelete: 20,
      skippedVerifyMigrated: 20,
    });

    const putItems = dynamoDocumentMock
      .commandCalls(PutCommand)
      .map((c) => c.args[0].input.Item);
    expect(
      putItems.every((item) =>
        expect(item?.iadQueryLogicHash).toEqual({
          hash: "test-hash",
          algorithm: "sha256",
          generatedAt: "1970-01-01T00:00:00.000Z",
        })
      )
    ).toBe(true);

    vi.useRealTimers();
  });

  test("saves the full iadQueryLogicHash object on each forecast record", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    dynamoMock.on(DescribeTableCommand).resolves({ Table: { ItemCount: 0 } });
    dynamoDocumentMock.on(QueryCommand).resolves({ Count: 5, ScannedCount: 5 });
    dynamoDocumentMock.on(PutCommand).resolves({});

    await handler({}, mockContext());

    const [firstPut] = dynamoDocumentMock.commandCalls(PutCommand);
    expect(firstPut.args[0].input.Item).toMatchObject({
      iadQueryLogicHash: {
        hash: "test-hash",
        algorithm: "sha256",
        generatedAt: "1970-01-01T00:00:00.000Z",
      },
    });

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
