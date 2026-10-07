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
const PRECEDING_FORECAST_DAYS = 30;
const EXPECTED_QUERY_COUNT =
  PRECEDING_FORECAST_DAYS +
  (SKIP_EMAIL_REASON_BREAKDOWN_DAYS + 1) * 2 +
  (FORECAST_DAYS - (SKIP_EMAIL_REASON_BREAKDOWN_DAYS + 1));

const datesFrom = (today: Date, precedingDays: number, totalDays: number) => {
  const start = new Date(today);
  start.setDate(start.getDate() - precedingDays);
  return buildDates(start, totalDays);
};
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
  test("returns the correct number of dates starting from today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const dates = buildDates(new Date(), 3);
    expect(dates).toEqual(["2026-01-01", "2026-01-02", "2026-01-03"]);

    vi.useRealTimers();
  });

  test("returns a single date matching today when asked for one day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const dates = buildDates(new Date(), 1);
    expect(dates).toEqual(["2026-01-01"]);

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
    expect(mockMetrics.publishStoredMetrics).toHaveBeenCalledTimes(2);

    expect(dynamoDocumentMock.commandCalls(QueryCommand)).toHaveLength(
      EXPECTED_QUERY_COUNT
    );
    expect(dynamoDocumentMock.commandCalls(PutCommand)).toHaveLength(
      FORECAST_DAYS + PRECEDING_FORECAST_DAYS
    );

    vi.useRealTimers();
  });

  test("logs willSendWarningEmails, skippedNoMfa and skippedUndeliverable for a date within the 90-day window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const infoSpy = vi.spyOn(Logger.prototype, "info");

    dynamoMock.on(DescribeTableCommand).resolves({ Table: { ItemCount: 0 } });
    dynamoDocumentMock.on(QueryCommand).resolves({ Count: 0, ScannedCount: 0 });
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

    // Today lands in the second batch, since the first batch is filled by
    // dates still in the past. Time runs out right after.
    let remainingCalls = 0;
    context.getRemainingTimeInMillis = () =>
      remainingCalls++ <= 1 ? 900_000 : 5_000;

    await handler({}, context);

    expect(infoSpy).toHaveBeenCalledWith(
      "Deletion forecast",
      expect.objectContaining({
        dateForDeletion: "2026-01-01",
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
      label: "stops during the first (all-past) batch",
      remainingTimesMs: [5_000],
      expectedPastWritten: 20,
      expectedTodayOnwardsWritten: 0,
    },
    {
      label: "stops in the batch spanning yesterday and today",
      remainingTimesMs: [900_000, 5_000],
      expectedPastWritten: 30,
      expectedTodayOnwardsWritten: 10,
    },
    {
      label: "stops in a batch made up entirely of today-onwards dates",
      remainingTimesMs: [900_000, 900_000, 5_000],
      expectedPastWritten: 30,
      expectedTodayOnwardsWritten: 30,
    },
  ])(
    "stops once time is nearly up, forecasting only the soonest remaining dates ($label)",
    async ({
      remainingTimesMs,
      expectedPastWritten,
      expectedTodayOnwardsWritten,
    }) => {
      vi.useFakeTimers();
      const today = new Date("2026-01-01T00:00:00.000Z");
      vi.setSystemTime(today);

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

      const todayString = today.toISOString().split("T")[0];
      const putDates = dynamoDocumentMock
        .commandCalls(PutCommand)
        .map(
          (putCall) => putCall.args[0].input.Item?.dateForDeletion as string
        );

      const pastWritten = putDates.filter((d) => d < todayString);
      const todayOnwardsWritten = putDates.filter((d) => d >= todayString);

      expect(pastWritten).toHaveLength(expectedPastWritten);
      expect(todayOnwardsWritten).toHaveLength(expectedTodayOnwardsWritten);
      expect(todayOnwardsWritten).toEqual(
        buildDates(today, expectedTodayOnwardsWritten)
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

  test("publishes OverdueDeletionAccounts metric summing counts for preceding dates 5+ days ago", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));

    dynamoMock.on(DescribeTableCommand).resolves({ Table: { ItemCount: 0 } });
    dynamoDocumentMock.on(QueryCommand).resolves({ Count: 2, ScannedCount: 2 });
    dynamoDocumentMock.on(PutCommand).resolves({});

    await handler({}, mockContext());

    const overdueCalls = mockMetrics.addMetric.mock.calls.filter(
      ([name]) => name === "OverdueDeletionAccounts"
    );
    expect(overdueCalls).toHaveLength(1);
    // 30 past days, of which days 1-4 ago are not overdue (< 5 days):
    // 26 overdue dates * 2 accounts each = 52.
    expect(overdueCalls[0]).toEqual(["OverdueDeletionAccounts", "Count", 52]);

    vi.useRealTimers();
  });

  test("publishes OverdueDeletionAccounts as 0 when no preceding dates have records", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));

    dynamoMock.on(DescribeTableCommand).resolves({ Table: { ItemCount: 0 } });
    dynamoDocumentMock.on(QueryCommand).resolves({ Count: 0, ScannedCount: 0 });
    dynamoDocumentMock.on(PutCommand).resolves({});

    await handler({}, mockContext());

    const overdueCalls = mockMetrics.addMetric.mock.calls.filter(
      ([name]) => name === "OverdueDeletionAccounts"
    );
    expect(overdueCalls).toHaveLength(1);
    expect(overdueCalls[0]).toEqual(["OverdueDeletionAccounts", "Count", 0]);

    vi.useRealTimers();
  });

  test("persists a forecast record for every past date, in the same shape as today-onwards dates", async () => {
    vi.useFakeTimers();
    const today = new Date("2026-06-15T00:00:00.000Z");
    vi.setSystemTime(today);

    const infoSpy = vi.spyOn(Logger.prototype, "info");

    dynamoMock.on(DescribeTableCommand).resolves({ Table: { ItemCount: 0 } });
    dynamoDocumentMock.on(QueryCommand).resolves({ Count: 4, ScannedCount: 4 });
    dynamoDocumentMock.on(PutCommand).resolves({});

    await handler({}, mockContext());

    const todayString = today.toISOString().split("T")[0];
    const pastDates = datesFrom(today, 30, 30).filter((d) => d < todayString);
    const putCalls = dynamoDocumentMock.commandCalls(PutCommand);
    const putDates = putCalls.map(
      (call) => call.args[0].input.Item?.dateForDeletion
    );

    for (const date of pastDates) {
      expect(putDates).toContain(date);
    }

    expect(infoSpy).toHaveBeenCalledWith("Deletion forecast", {
      dateForDeletion: "2026-06-14",
      accountsToDelete: 4,
    });

    const pastPut = putCalls.find(
      (call) => call.args[0].input.Item?.dateForDeletion === "2026-06-14"
    );
    expect(pastPut?.args[0].input).toEqual({
      TableName: "forecast-table",
      Item: {
        dateForDeletion: "2026-06-14",
        forecastedAt: "2026-06-15T00:00:00.000Z",
        accountsToDelete: 4,
        ttl:
          Math.floor(new Date("2026-06-15T00:00:00.000Z").getTime() / 1000) +
          365 * 24 * 60 * 60,
        iadQueryLogicHash: {
          hash: "test-hash",
          algorithm: "sha256",
          generatedAt: "1970-01-01T00:00:00.000Z",
        },
      },
    });

    vi.useRealTimers();
  });
});
