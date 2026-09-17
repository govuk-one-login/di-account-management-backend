import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  disableIad,
  getIadCircuitBreakerStatus,
} from "../common/iad-circuit-breaker.js";

const dynamoMock = mockClient(DynamoDBDocumentClient);

const TABLE_NAME = "test-iad-table";

const makeItem = (enabled: boolean, metadata?: unknown) => ({
  pk: "IAD",
  datetime: "2024-01-15T10:30:00.000Z",
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

  test("returns item with enabled: true", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [makeItem(true)] });

    const result = await getIadCircuitBreakerStatus();
    expect(result.enabled).toBe(true);
  });

  test("returns item with enabled: false", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [makeItem(false)] });

    const result = await getIadCircuitBreakerStatus();
    expect(result.enabled).toBe(false);
  });

  test("returns datetime as a Date object", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [makeItem(true)] });

    const result = await getIadCircuitBreakerStatus();
    expect(result.datetime).toBeInstanceOf(Date);
    expect(result.datetime.toISOString()).toBe("2024-01-15T10:30:00.000Z");
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

  test("throws when no items are returned", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [] });

    await expect(getIadCircuitBreakerStatus()).rejects.toThrow();
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

  test("puts an item with a valid ISO datetime", async () => {
    const before = new Date().toISOString();
    await disableIad({});
    const after = new Date().toISOString();

    const call = dynamoMock.commandCalls(PutCommand)[0];
    const datetime = call.args[0].input.Item?.datetime as string;

    expect(datetime >= before).toBe(true);
    expect(datetime <= after).toBe(true);
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
