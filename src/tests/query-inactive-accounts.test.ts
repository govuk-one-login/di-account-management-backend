import { describe, test, expect, beforeEach } from "vitest";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import {
  queryAccountsByDate,
  countAccountsForDate,
} from "../common/query-inactive-accounts.js";
import type { InactiveAccountTrackerRecord } from "../common/model.js";

const dynamoMock = mockClient(DynamoDBDocumentClient);

const mockRecord = {
  dateForDeletion: "2026-06-20",
  commonSubjectId: "user-1",
  publicSubjectId: "public-subject-1",
  emailAddress: "test@example.com",
  userLastActive: "2021-06-20T00:00:00.000Z",
  userLastActiveSource: "AUTH_AUTH_CODE_ISSUED",
  userLastActiveUpdated: "2026-01-01T00:00:00.000Z",
  emailAddressSource: "AUTH_AUTH_CODE_ISSUED",
  emailAddressLastUpdated: "2026-01-01T00:00:00.000Z",
  status: "pending",
  statusLastUpdated: "2026-01-01T00:00:00.000Z",
  hasSetupMfa: false,
};

describe("queryAccountsByDate", () => {
  beforeEach(() => {
    dynamoMock.reset();
  });

  test("yields pages across paginated results", async () => {
    dynamoMock
      .on(QueryCommand)
      .resolvesOnce({
        Items: [mockRecord],
        LastEvaluatedKey: {
          dateForDeletion: "2026-06-20",
          commonSubjectId: "user-1",
        },
      })
      .resolvesOnce({
        Items: [{ ...mockRecord, commonSubjectId: "user-2" }],
        LastEvaluatedKey: undefined,
      });

    const pages: InactiveAccountTrackerRecord[][] = [];
    for await (const page of queryAccountsByDate("table", "2026-06-20")) {
      pages.push(page);
    }
    expect(pages).toHaveLength(2);
    expect(pages.flat()).toHaveLength(2);
    expect(dynamoMock.commandCalls(QueryCommand)).toHaveLength(2);
  });

  test("yields nothing when no results", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [] });

    const pages: InactiveAccountTrackerRecord[][] = [];
    for await (const page of queryAccountsByDate("table", "2026-06-20")) {
      pages.push(page);
    }
    expect(pages).toHaveLength(0);
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
        LastEvaluatedKey: {
          dateForDeletion: "2026-06-01",
          commonSubjectId: "x",
        },
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

    await expect(
      countAccountsForDate("my-table", "2026-06-01")
    ).rejects.toThrow("DynamoDB failure");
  });
});

describe("queryAccountsByDate and countAccountsForDate use the same key condition", () => {
  beforeEach(() => {
    dynamoMock.reset();
  });

  test("both functions query with matching KeyConditionExpression and ExpressionAttributeValues", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [mockRecord], Count: 1 });

    const pages: InactiveAccountTrackerRecord[][] = [];
    for await (const page of queryAccountsByDate(
      "shared-table",
      "2026-07-01"
    )) {
      pages.push(page);
    }
    await countAccountsForDate("shared-table", "2026-07-01");

    const calls = dynamoMock.commandCalls(QueryCommand);
    expect(calls).toHaveLength(2);

    const [queryCall, countCall] = calls;
    expect(queryCall.args[0].input.KeyConditionExpression).toBe(
      countCall.args[0].input.KeyConditionExpression
    );
    expect(queryCall.args[0].input.ExpressionAttributeValues).toEqual(
      countCall.args[0].input.ExpressionAttributeValues
    );
  });
});
