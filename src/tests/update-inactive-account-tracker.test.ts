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
    dynamoMock.reset();
  });

  afterEach(() => {
    loggerInfoMock.mockClear();
    loggerWarnMock.mockClear();
    delete process.env.INACTIVE_ACCOUNT_TRACKER_TABLE_NAME;
    delete process.env.USER_NOTIFICATIONS_TABLE_NAME;
  });

  test("logs invocation message", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [] });
    dynamoMock.on(TransactWriteCommand).resolves({});
    const event: DynamoDBStreamEvent = { Records: [generateDynamoSteamRecord("test-client")] };
    await handler(event, {} as Context);
    expect(loggerInfoMock).toHaveBeenCalledWith(
      "UpdateInactiveAccountTracker invoked"
    );
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
            Item: expect.objectContaining({ commonSubjectId: "qwerty", status: "pending" }),
          }),
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
      ]),
    });
  });

  test("returns early and logs warning when currentItem status is deleting", async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [{ commonSubjectId: "qwerty", dateForDeletion: "2026-01-01", userLastActive: "2026-01-01T00:00:00.000Z", status: "deleting", emailAddress: "x", statusLastUpdated: "" }],
    });
    const event: DynamoDBStreamEvent = { Records: [generateDynamoSteamRecord("test-client")] };
    await handler(event, {} as Context);
    expect(loggerWarnMock).toHaveBeenCalledWith("AUTH_EVENT_ON_DELETED_ACCOUNT qwerty");
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

  test("adds notification to transaction when currentItem status is pending and no existing notification", async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [{ commonSubjectId: "qwerty", dateForDeletion: "2026-01-01", userLastActive: "2020-01-01T00:00:00.000Z", status: "pending", emailAddress: "x", statusLastUpdated: "" }],
    });
    dynamoMock.on(GetCommand).resolves({ Item: undefined });
    dynamoMock.on(TransactWriteCommand).resolves({});
    const event: DynamoDBStreamEvent = { Records: [generateDynamoSteamRecord("test-client")] };
    await handler(event, {} as Context);
    expect(dynamoMock).toHaveReceivedCommandWith(GetCommand, {
      TableName: "user-notifications-table",
      Key: { internalCommonSubjectId: "qwerty" },
    });
    expect(dynamoMock).toHaveReceivedCommandWith(TransactWriteCommand, {
      TransactItems: expect.arrayContaining([
        expect.objectContaining({
          Put: expect.objectContaining({
            TableName: "user-notifications-table",
            Item: expect.objectContaining({ internalCommonSubjectId: "qwerty", notificationType: "AccountKept" }),
          }),
        }),
      ]),
    });
  });

  test("does not add notification when existing notification found", async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [{ commonSubjectId: "qwerty", dateForDeletion: "2026-01-01", userLastActive: "2020-01-01T00:00:00.000Z", status: "pending", emailAddress: "x", statusLastUpdated: "" }],
    });
    dynamoMock.on(GetCommand).resolves({ Item: { internalCommonSubjectId: "qwerty" } });
    dynamoMock.on(TransactWriteCommand).resolves({});
    const event: DynamoDBStreamEvent = { Records: [generateDynamoSteamRecord("test-client")] };
    await handler(event, {} as Context);
    expect(dynamoMock).toHaveReceivedCommandWith(TransactWriteCommand, {
      TransactItems: expect.not.arrayContaining([
        expect.objectContaining({
          Put: expect.objectContaining({ TableName: "user-notifications-table" }),
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

  test("throws error when transaction fails", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [] });
    dynamoMock.on(TransactWriteCommand).rejects(new Error("TransactionCanceledException"));
    const event: DynamoDBStreamEvent = { Records: [generateDynamoSteamRecord("test-client")] };
    await expect(handler(event, {} as Context)).rejects.toThrow(
      "Failed to update inactive account tracker for user qwerty"
    );
  });
});
