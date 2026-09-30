import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  tripIadCircuitBreaker,
  isIadCircuitBreakerTripped,
} from "../common/iad-circuit-breaker.js";

const dynamoMock = mockClient(DynamoDBDocumentClient);

const TABLE_NAME = "test-iad-table";

const makeItem = (enabled: boolean, metadata?: unknown) => ({
  pk: "IAD",
  datetime: 1705315800000,
  enabled,
  ...(metadata !== undefined ? { metadataJson: JSON.stringify(metadata) } : {}),
});

describe("isIadCircuitBreakerTripped", () => {
  beforeEach(() => {
    process.env.INACTIVE_ACCOUNT_CIRCUIT_BREAKER_TABLE_NAME = TABLE_NAME;
    dynamoMock.reset();
  });

  afterEach(() => {
    delete process.env.INACTIVE_ACCOUNT_CIRCUIT_BREAKER_TABLE_NAME;
  });

  test("returns false when latest item has enabled: true (IAD is enabled)", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [makeItem(true)] });

    expect(await isIadCircuitBreakerTripped()).toBe(false);
  });

  test("returns true when latest item has enabled: false (IAD is disabled)", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [makeItem(false)] });

    expect(await isIadCircuitBreakerTripped()).toBe(true);
  });

  test("returns false when no items are returned", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [] });

    expect(await isIadCircuitBreakerTripped()).toBe(false);
  });

  test("returns false when Items is undefined", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: undefined });

    expect(await isIadCircuitBreakerTripped()).toBe(false);
  });

  test("queries with correct parameters", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [makeItem(true)] });

    await isIadCircuitBreakerTripped();

    expect(dynamoMock).toHaveReceivedCommandWith(QueryCommand, {
      TableName: TABLE_NAME,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": "IAD" },
      ScanIndexForward: false,
      Limit: 1,
      ConsistentRead: true,
    });
  });

  test("throws when env var is not set", async () => {
    delete process.env.INACTIVE_ACCOUNT_CIRCUIT_BREAKER_TABLE_NAME;

    await expect(isIadCircuitBreakerTripped()).rejects.toThrow(
      `Environment variable "INACTIVE_ACCOUNT_CIRCUIT_BREAKER_TABLE_NAME" is not set.`
    );
  });
});

describe("tripIadCircuitBreaker", () => {
  beforeEach(() => {
    process.env.INACTIVE_ACCOUNT_CIRCUIT_BREAKER_TABLE_NAME = TABLE_NAME;
    dynamoMock.reset();
    dynamoMock.on(PutCommand).resolves({});
  });

  afterEach(() => {
    delete process.env.INACTIVE_ACCOUNT_CIRCUIT_BREAKER_TABLE_NAME;
  });

  test("puts an item with enabled: false", async () => {
    await tripIadCircuitBreaker({});

    expect(dynamoMock).toHaveReceivedCommandWith(PutCommand, {
      TableName: TABLE_NAME,
      Item: expect.objectContaining({ pk: "IAD", enabled: false }),
    });
  });

  test("puts an item with a valid unix timestamp in milliseconds", async () => {
    const fixedDate = new Date("2024-01-15T10:30:00.000Z");
    vi.setSystemTime(fixedDate);
    await tripIadCircuitBreaker({});
    vi.useRealTimers();

    expect(dynamoMock).toHaveReceivedCommandWith(PutCommand, {
      TableName: TABLE_NAME,
      Item: expect.objectContaining({ datetime: fixedDate.getTime() }),
    });
  });

  test("serialises metadata as JSON", async () => {
    const metadata = { reason: "manual-disable", operator: "test-user" };
    await tripIadCircuitBreaker(metadata);

    expect(dynamoMock).toHaveReceivedCommandWith(PutCommand, {
      TableName: TABLE_NAME,
      Item: expect.objectContaining({
        metadataJson: JSON.stringify(metadata),
      }),
    });
  });

  test("throws when env var is not set", async () => {
    delete process.env.INACTIVE_ACCOUNT_CIRCUIT_BREAKER_TABLE_NAME;

    await expect(tripIadCircuitBreaker({})).rejects.toThrow(
      `Environment variable "INACTIVE_ACCOUNT_CIRCUIT_BREAKER_TABLE_NAME" is not set.`
    );
  });
});
