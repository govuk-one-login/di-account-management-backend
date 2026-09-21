import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  disableIad,
  getIadCircuitBreakerStatus,
} from "../common/iadGuards/circuitBreaker.js";

const dynamoMock = mockClient(DynamoDBDocumentClient);

const TABLE_NAME = "test-iad-table";

const makeItem = (enabled: boolean, metadata?: unknown) => ({
  pk: "IAD",
  datetime: 1705315800000,
  enabled,
  ...(metadata !== undefined ? { metadataJson: JSON.stringify(metadata) } : {}),
});

describe("getIadCircuitBreakerStatus", () => {
  beforeEach(() => {
    process.env.INACTIVE_ACCOUNT_CIRCUIT_BREAKER_TABLE_NAME = TABLE_NAME;
    dynamoMock.reset();
  });

  afterEach(() => {
    delete process.env.INACTIVE_ACCOUNT_CIRCUIT_BREAKER_TABLE_NAME;
  });

  test("returns true when latest item has enabled: true", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [makeItem(true)] });

    expect(await getIadCircuitBreakerStatus()).toBe(true);
  });

  test("returns false when latest item has enabled: false", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [makeItem(false)] });

    expect(await getIadCircuitBreakerStatus()).toBe(false);
  });

  test("returns false when no items are returned", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [] });

    expect(await getIadCircuitBreakerStatus()).toBe(false);
  });

  test("returns false when Items is undefined", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: undefined });

    expect(await getIadCircuitBreakerStatus()).toBe(false);
  });

  test("queries with correct parameters", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [makeItem(true)] });

    await getIadCircuitBreakerStatus();

    expect(dynamoMock).toHaveReceivedCommandWith(QueryCommand, {
      TableName: TABLE_NAME,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": { S: "IAD" } },
      ScanIndexForward: false,
      Limit: 1,
      ConsistentRead: true,
    });
  });

  test("throws when env var is not set", async () => {
    delete process.env.INACTIVE_ACCOUNT_CIRCUIT_BREAKER_TABLE_NAME;

    await expect(getIadCircuitBreakerStatus()).rejects.toThrow(
      `Environment variable "INACTIVE_ACCOUNT_CIRCUIT_BREAKER_TABLE_NAME" is not set.`
    );
  });
});

describe("disableIad", () => {
  beforeEach(() => {
    process.env.INACTIVE_ACCOUNT_CIRCUIT_BREAKER_TABLE_NAME = TABLE_NAME;
    dynamoMock.reset();
    dynamoMock.on(PutCommand).resolves({});
  });

  afterEach(() => {
    delete process.env.INACTIVE_ACCOUNT_CIRCUIT_BREAKER_TABLE_NAME;
  });

  test("puts an item with enabled: false", async () => {
    await disableIad({});

    expect(dynamoMock).toHaveReceivedCommandWith(PutCommand, {
      TableName: TABLE_NAME,
      Item: expect.objectContaining({ pk: "IAD", enabled: false }),
    });
  });

  test("puts an item with a valid unix timestamp in milliseconds", async () => {
    const fixedDate = new Date("2024-01-15T10:30:00.000Z");
    vi.setSystemTime(fixedDate);
    await disableIad({});
    vi.useRealTimers();

    expect(dynamoMock).toHaveReceivedCommandWith(PutCommand, {
      TableName: TABLE_NAME,
      Item: expect.objectContaining({ datetime: fixedDate.getTime() }),
    });
  });

  test("serialises metadata as JSON", async () => {
    const metadata = { reason: "manual-disable", operator: "test-user" };
    await disableIad(metadata);

    expect(dynamoMock).toHaveReceivedCommandWith(PutCommand, {
      TableName: TABLE_NAME,
      Item: expect.objectContaining({
        metadataJson: JSON.stringify(metadata),
      }),
    });
  });

  test("throws when env var is not set", async () => {
    delete process.env.INACTIVE_ACCOUNT_CIRCUIT_BREAKER_TABLE_NAME;

    await expect(disableIad({})).rejects.toThrow(
      `Environment variable "INACTIVE_ACCOUNT_CIRCUIT_BREAKER_TABLE_NAME" is not set.`
    );
  });
});
