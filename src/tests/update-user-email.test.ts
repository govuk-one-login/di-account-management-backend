import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { Context, DynamoDBStreamEvent } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { handler } from "../update-user-email.js";

const dynamoMock = mockClient(DynamoDBDocumentClient);

describe("update-user-email", () => {
  vi.spyOn(Logger.prototype, "info").mockImplementation(() => undefined);
  const loggerWarnMock = vi
    .spyOn(Logger.prototype, "warn")
    .mockImplementation(() => undefined);

  beforeEach(() => {
    process.env.INACTIVE_ACCOUNT_TRACKER_TABLE_NAME = "test-inactive-tracker-table";
    dynamoMock.reset();
  });

  afterEach(() => {
    loggerWarnMock.mockClear();
    delete process.env.INACTIVE_ACCOUNT_TRACKER_TABLE_NAME;
  });

  const createEvent = (
    userId?: string,
    email?: string
  ): DynamoDBStreamEvent =>
    ({
      Records: [
        {
          dynamodb: {
            NewImage: {
              event: {
                M: {
                  event_name: { S: "AUTH_UPDATE_EMAIL" },
                  timestamp: { N: "1666169856" },
                  user: {
                    M: {
                      ...(userId ? { user_id: { S: userId } } : {}),
                      ...(email ? { email: { S: email } } : {}),
                    },
                  },
                },
              },
            },
          },
        },
      ],
    }) as unknown as DynamoDBStreamEvent;

  it("throws an error when user_id is missing", async () => {
    await expect(
      handler(createEvent(undefined, "new-email@example.com"), {} as Context)
    ).rejects.toThrow("user_id is missing from the event");
  });

  it("throws an error when email is missing", async () => {
    await expect(
      handler(createEvent("test-user-id", undefined), {} as Context)
    ).rejects.toThrow("email is missing from the event");
  });

  it("queries the CommonSubjectIdIndex with the user_id", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [{ dateForDeletion: "2031-06-30", commonSubjectId: "test-user-id" }] });
    dynamoMock.on(UpdateCommand).resolves({});

    await handler(createEvent("test-user-id", "new-email@example.com"), {} as Context);

    expect(dynamoMock).toHaveReceivedCommandWith(QueryCommand, {
      TableName: "test-inactive-tracker-table",
      IndexName: "CommonSubjectIdIndex",
      KeyConditionExpression: "commonSubjectId = :uid",
      ExpressionAttributeValues: { ":uid": "test-user-id" },
    });
  });

  it("updates the emailAddress field when a record is found", async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [{ dateForDeletion: "2031-06-30", commonSubjectId: "test-user-id", emailAddress: "old@example.com" }],
    });
    dynamoMock.on(UpdateCommand).resolves({});

    await handler(createEvent("test-user-id", "new-email@example.com"), {} as Context);

    expect(dynamoMock).toHaveReceivedCommandWith(UpdateCommand, {
      TableName: "test-inactive-tracker-table",
      Key: {
        dateForDeletion: "2031-06-30",
        commonSubjectId: "test-user-id",
      },
      UpdateExpression: "SET emailAddress = :email",
      ExpressionAttributeValues: { ":email": "new-email@example.com" },
    });
  });

  it("does not update when no record is found for the user", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [] });

    await handler(createEvent("test-user-id", "new-email@example.com"), {} as Context);

    expect(dynamoMock).not.toHaveReceivedCommand(UpdateCommand);
    expect(loggerWarnMock).toHaveBeenCalledWith(
      "No inactive account tracker record found for user",
      { userId: "test-user-id" }
    );
  });

  it("processes multiple records in a single event", async () => {
    dynamoMock.on(QueryCommand)
      .resolvesOnce({ Items: [{ dateForDeletion: "2031-06-30", commonSubjectId: "user-1" }] })
      .resolvesOnce({ Items: [{ dateForDeletion: "2031-07-15", commonSubjectId: "user-2" }] });
    dynamoMock.on(UpdateCommand).resolves({});

    const multiRecordEvent = {
      Records: [
        {
          dynamodb: {
            NewImage: {
              event: {
                M: {
                  event_name: { S: "AUTH_UPDATE_EMAIL" },
                  timestamp: { N: "1666169856" },
                  user: {
                    M: {
                      user_id: { S: "user-1" },
                      email: { S: "user1@example.com" },
                    },
                  },
                },
              },
            },
          },
        },
        {
          dynamodb: {
            NewImage: {
              event: {
                M: {
                  event_name: { S: "AUTH_UPDATE_EMAIL" },
                  timestamp: { N: "1666169900" },
                  user: {
                    M: {
                      user_id: { S: "user-2" },
                      email: { S: "user2@example.com" },
                    },
                  },
                },
              },
            },
          },
        },
      ],
    } as unknown as DynamoDBStreamEvent;

    await handler(multiRecordEvent, {} as Context);

    expect(dynamoMock).toHaveReceivedCommandTimes(QueryCommand, 2);
    expect(dynamoMock).toHaveReceivedCommandTimes(UpdateCommand, 2);
  });

  it("throws an error when INACTIVE_ACCOUNT_TRACKER_TABLE_NAME is not set", async () => {
    delete process.env.INACTIVE_ACCOUNT_TRACKER_TABLE_NAME;

    await expect(
      handler(createEvent("test-user-id", "new-email@example.com"), {} as Context)
    ).rejects.toThrow('Environment variable "INACTIVE_ACCOUNT_TRACKER_TABLE_NAME" is not set.');
  });
});
