import { vi, describe, test, expect, afterEach, beforeEach } from "vitest";
import { Context, DynamoDBStreamEvent } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { handler } from "../update-inactive-account-tracker.js";
import { generateDynamoSteamRecord } from "./testFixtures.js";

const dynamoMock = mockClient(DynamoDBDocumentClient);

describe("UpdateInactiveAccountTracker handler", () => {
  const loggerInfoMock = vi
    .spyOn(Logger.prototype, "info")
    .mockImplementation(() => undefined);
  const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

  beforeEach(() => {
    process.env.INACTIVE_ACCOUNT_TRACKER_TABLE_NAME = "test-table";
    dynamoMock.reset();
  });

  afterEach(() => {
    loggerInfoMock.mockClear();
    consoleSpy.mockClear();
    delete process.env.INACTIVE_ACCOUNT_TRACKER_TABLE_NAME;
  });

  test("logs invocation message", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [] });
    const event: DynamoDBStreamEvent = { Records: [generateDynamoSteamRecord("test-client")] };
    await handler(event, {} as Context);
    expect(loggerInfoMock).toHaveBeenCalledWith(
      "UpdateInactiveAccountTracker invoked"
    );
  });

  test("logs dateForDeletion when record exists in InactiveAccountTracker", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [{ dateForDeletion: "2026-12-01" }] });
    const event: DynamoDBStreamEvent = { Records: [generateDynamoSteamRecord("test-client")] };
    await handler(event, {} as Context);
    expect(consoleSpy).toHaveBeenCalledWith("2026-12-01");
  });

  test("does not log dateForDeletion when no record exists", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [] });
    const event: DynamoDBStreamEvent = { Records: [generateDynamoSteamRecord("test-client")] };
    await handler(event, {} as Context);
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  test("queries CommonSubjectIdIndex with user_id", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [] });
    const event: DynamoDBStreamEvent = { Records: [generateDynamoSteamRecord("test-client")] };
    await handler(event, {} as Context);
    expect(dynamoMock).toHaveReceivedCommandWith(QueryCommand, {
      TableName: "test-table",
      IndexName: "CommonSubjectIdIndex",
      KeyConditionExpression: "commonSubjectId = :uid",
      ExpressionAttributeValues: { ":uid": "qwerty" },
    });
  });
});
