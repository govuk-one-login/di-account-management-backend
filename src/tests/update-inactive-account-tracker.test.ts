import { vi, describe, test, expect, afterEach, beforeEach } from "vitest";
import { Context, DynamoDBStreamEvent } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, GetCommand, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { handler } from "../update-inactive-account-tracker.js";
import { generateDynamoSteamRecord } from "./testFixtures.js";

const dynamoMock = mockClient(DynamoDBDocumentClient);

describe("UpdateInactiveAccountTracker handler", () => {
  const loggerInfoMock = vi
    .spyOn(Logger.prototype, "info")
    .mockImplementation(() => undefined);
  const loggerWarnMock = vi
    .spyOn(Logger.prototype, "warn")
    .mockImplementation(() => undefined);

  beforeEach(() => {
    process.env.INACTIVE_ACCOUNT_TRACKER_TABLE_NAME = "test-table";
    process.env.USER_NOTIFICATIONS_TABLE_NAME = "user-notifications-table";
    process.env.OLH_CLIENT_ID = "test-client";
    dynamoMock.reset();
  });

  afterEach(() => {
    loggerInfoMock.mockClear();
    loggerWarnMock.mockClear();
    delete process.env.INACTIVE_ACCOUNT_TRACKER_TABLE_NAME;
    delete process.env.USER_NOTIFICATIONS_TABLE_NAME;
    delete process.env.OLH_CLIENT_ID;
  });

  test("queries CommonSubjectIdIndex with user_id", async () => {

    dynamoMock.on(QueryCommand).resolves({ Items: [] });
    dynamoMock.on(TransactWriteCommand).resolves({});
    const event: DynamoDBStreamEvent = { Records: [generateDynamoSteamRecord("test-client")] };
    await handler(event, {} as Context);
    expect(dynamoMock).toHaveReceivedCommandWith(QueryCommand, {
      TableName: "test-table",
      IndexName: "CommonSubjectIdIndex",
      KeyConditionExpression: "commonSubjectId = :uid",
      ExpressionAttributeValues: { ":uid": "qwerty" },
    });
  });

  test("writes new tracker record via transaction when no existing record", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [] });
    dynamoMock.on(TransactWriteCommand).resolves({});
    const event: DynamoDBStreamEvent = { Records: [generateDynamoSteamRecord("test-client")] };
    await handler(event, {} as Context);
    expect(dynamoMock).toHaveReceivedCommandWith(TransactWriteCommand, {
      TransactItems: expect.arrayContaining([
        expect.objectContaining({
          Put: expect.objectContaining({
            TableName: "test-table",
            Item: expect.objectContaining({ commonSubjectId: "qwerty", status: "pending", source: "txma_audit_event", sourceId: "event_id" }),
          }),
        }),
      ]),
    });
    expect(dynamoMock).toHaveReceivedCommandWith(TransactWriteCommand, {
      TransactItems: expect.not.arrayContaining([
        expect.objectContaining({
          Delete: expect.objectContaining({ TableName: "test-table" }),
        }),
      ]),
    });
  });

  test("uses event timestamp as latestDate when no existing record", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [] });
    dynamoMock.on(TransactWriteCommand).resolves({});
    const event: DynamoDBStreamEvent = { Records: [generateDynamoSteamRecord("test-client")] };
    await handler(event, {} as Context);
    expect(dynamoMock).toHaveReceivedCommandWith(TransactWriteCommand, {
      TransactItems: expect.arrayContaining([
        expect.objectContaining({
          Put: expect.objectContaining({
            Item: expect.objectContaining({ userLastActive: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) }),
          }),
        }),
      ]),
    });
  });

  test("uses existing userLastActive when it is later than event timestamp", async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    dynamoMock.on(QueryCommand).resolves({
      Items: [{ commonSubjectId: "qwerty", dateForDeletion: "2099-01-01", userLastActive: futureDate, status: "active", emailAddress: "x", statusLastUpdated: "" }],
    });
    dynamoMock.on(TransactWriteCommand).resolves({});
    const event: DynamoDBStreamEvent = { Records: [generateDynamoSteamRecord("test-client")] };
    await handler(event, {} as Context);
    expect(dynamoMock).toHaveReceivedCommandWith(TransactWriteCommand, {
      TransactItems: expect.arrayContaining([
        expect.objectContaining({
          Put: expect.objectContaining({
            Item: expect.objectContaining({ userLastActive: futureDate }),
          }),
        }),
        expect.objectContaining({
          Delete: expect.objectContaining({
            TableName: "test-table",
            Key: { dateForDeletion: "2099-01-01", commonSubjectId: "qwerty" },
          }),
        }),
      ]),
    });
  });

  test("returns early and logs warning when currentItem status is deleting", async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [{ commonSubjectId: "qwerty", dateForDeletion: "2026-01-01", userLastActive: "2026-01-01T00:00:00.000Z", status: "deleting", emailAddress: "x", statusLastUpdated: "" }],
    });
    const event: DynamoDBStreamEvent = { Records: [generateDynamoSteamRecord("test-client")] };
    await handler(event, {} as Context);
    expect(loggerWarnMock).toHaveBeenCalledWith("AUTH_EVENT_ON_DELETING_ACCOUNT qwerty");
    expect(dynamoMock).not.toHaveReceivedCommand(TransactWriteCommand);
  });

  test("throws assertion error when more than one tracker record exists", async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [
        { commonSubjectId: "qwerty", dateForDeletion: "2026-01-01", userLastActive: "2026-01-01T00:00:00.000Z", status: "pending", emailAddress: "x", statusLastUpdated: "" },
        { commonSubjectId: "qwerty", dateForDeletion: "2026-01-02", userLastActive: "2026-01-02T00:00:00.000Z", status: "pending", emailAddress: "x", statusLastUpdated: "" },
      ],
    });
    const event: DynamoDBStreamEvent = { Records: [generateDynamoSteamRecord("test-client")] };
    await expect(handler(event, {} as Context)).rejects.toThrow("found more than one inactivity tracker record for qwerty");
  });

  test("does not delete notification when no existing notification found", async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [{ commonSubjectId: "qwerty", dateForDeletion: "2026-01-01", userLastActive: "2020-01-01T00:00:00.000Z", status: "pending", emailAddress: "x", statusLastUpdated: "" }],
    });
    dynamoMock.on(GetCommand).resolves({ Item: undefined });
    dynamoMock.on(TransactWriteCommand).resolves({});
    const event: DynamoDBStreamEvent = { Records: [generateDynamoSteamRecord("test-client")] };
    await handler(event, {} as Context);
    expect(dynamoMock).toHaveReceivedCommandWith(TransactWriteCommand, {
      TransactItems: expect.not.arrayContaining([
        expect.objectContaining({
          Delete: expect.objectContaining({ TableName: "user-notifications-table" }),
        }),
      ]),
    });
  });

  test("does not check notification store when currentItem status is not pending", async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [{ commonSubjectId: "qwerty", dateForDeletion: "2026-01-01", userLastActive: "2020-01-01T00:00:00.000Z", status: "active", emailAddress: "x", statusLastUpdated: "" }],
    });
    dynamoMock.on(TransactWriteCommand).resolves({});
    const event: DynamoDBStreamEvent = { Records: [generateDynamoSteamRecord("test-client")] };
    await handler(event, {} as Context);
    expect(dynamoMock).not.toHaveReceivedCommand(GetCommand);
  });

  test("does not delete tracker record when dateForDeletion is unchanged", async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [{ commonSubjectId: "qwerty", dateForDeletion: "1978-11-29", userLastActive: "1970-01-01T00:00:00.000Z", status: "pending", emailAddress: "x", statusLastUpdated: "" }],
    });
    dynamoMock.on(TransactWriteCommand).resolves({});
    const event: DynamoDBStreamEvent = { Records: [generateDynamoSteamRecord("test-client")] };
    await handler(event, {} as Context);
    expect(dynamoMock).toHaveReceivedCommandWith(TransactWriteCommand, {
      TransactItems: expect.not.arrayContaining([
        expect.objectContaining({
          Delete: expect.objectContaining({ TableName: "test-table" }),
        }),
      ]),
    });
  });

  test("throws error when transaction fails", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [] });
    dynamoMock.on(TransactWriteCommand).rejects(new Error("TransactionCanceledException"));
    const event: DynamoDBStreamEvent = { Records: [generateDynamoSteamRecord("test-client")] };
    await expect(handler(event, {} as Context)).rejects.toThrow(
      "Failed to update inactive account tracker for user qwerty"
    );
  });
});
