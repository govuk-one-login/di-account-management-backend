import { vi, describe, test, expect, beforeEach, afterEach } from "vitest";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import {
  buildDates,
  countAccountsForDate,
  handler,
} from "../inactive-account-deletion-forecast.js";

const dynamoMock = mockClient(DynamoDBDocumentClient);

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
    dynamoMock.reset();
  });

  test("returns the count from a single page", async () => {
    dynamoMock.on(QueryCommand).resolves({ Count: 42 });

    const count = await countAccountsForDate("my-table", "2026-06-01");
    expect(count).toBe(42);
  });

  test("accumulates counts across paginated responses", async () => {
    dynamoMock
      .on(QueryCommand)
      .resolvesOnce({
        Count: 100,
        LastEvaluatedKey: { dateForDeletion: "2026-06-01", commonSubjectId: "x" },
      })
      .resolvesOnce({ Count: 50 });

    const count = await countAccountsForDate("my-table", "2026-06-01");
    expect(count).toBe(150);
    expect(dynamoMock.commandCalls(QueryCommand)).toHaveLength(2);
  });

  test("returns 0 when Count is undefined", async () => {
    dynamoMock.on(QueryCommand).resolves({});

    const count = await countAccountsForDate("my-table", "2026-06-01");
    expect(count).toBe(0);
  });

  test("throws on DynamoDB error", async () => {
    dynamoMock.on(QueryCommand).rejects(new Error("DynamoDB failure"));

    await expect(countAccountsForDate("my-table", "2026-06-01")).rejects.toThrow(
      "DynamoDB failure"
    );
  });
});

describe("handler", () => {
  beforeEach(() => {
    dynamoMock.reset();
    process.env.TABLE_NAME = "inactive-accounts-table";
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.TABLE_NAME;
  });

  test("queries 180 dates and publishes metrics", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    dynamoMock.on(QueryCommand).resolves({ Count: 10 });

    await handler();

    expect(dynamoMock.commandCalls(QueryCommand)).toHaveLength(180);

    vi.useRealTimers();
  });

  test("throws when TABLE_NAME is not set", async () => {
    delete process.env.TABLE_NAME;

    await expect(handler()).rejects.toThrow(
      'Environment variable "TABLE_NAME" is not set.'
    );
  });

  test("throws loudly on DynamoDB error", async () => {
    dynamoMock.on(QueryCommand).rejects(new Error("DynamoDB down"));

    await expect(handler()).rejects.toThrow("DynamoDB down");
  });
});
