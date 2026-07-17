import { vi, describe, test, expect, afterEach, beforeEach } from "vitest";
import { DynamoDBRecord, Context, DynamoDBStreamEvent } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, GetCommand, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { handler } from "../update-inactive-account-tracker.js";
import { generateDynamoStreamRecord } from "./testFixtures.js";

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
    const event: DynamoDBStreamEvent = { Records: [generateDynamoStreamRecord("test-client")] };
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
    const event: DynamoDBStreamEvent = { Records: [generateDynamoStreamRecord("test-client")] };
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
    const event: DynamoDBStreamEvent = { Records: [generateDynamoStreamRecord("test-client")] };
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
    const event: DynamoDBStreamEvent = { Records: [generateDynamoStreamRecord("test-client")] };
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
    const event: DynamoDBStreamEvent = { Records: [generateDynamoStreamRecord("test-client")] };
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
    const event: DynamoDBStreamEvent = { Records: [generateDynamoStreamRecord("test-client")] };
    await expect(handler(event, {} as Context)).rejects.toThrow("found more than one inactivity tracker record for qwerty");
  });

  test("does not delete notification when no existing notification found", async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [{ commonSubjectId: "qwerty", dateForDeletion: "2026-01-01", userLastActive: "2020-01-01T00:00:00.000Z", status: "pending", emailAddress: "x", statusLastUpdated: "" }],
    });
    dynamoMock.on(GetCommand).resolves({ Item: undefined });
    dynamoMock.on(TransactWriteCommand).resolves({});
    const event: DynamoDBStreamEvent = { Records: [generateDynamoStreamRecord("test-client")] };
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
    const event: DynamoDBStreamEvent = { Records: [generateDynamoStreamRecord("test-client")] };
    await handler(event, {} as Context);
    expect(dynamoMock).not.toHaveReceivedCommand(GetCommand);
  });

  test("does not delete tracker record when dateForDeletion is unchanged", async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [{ commonSubjectId: "qwerty", dateForDeletion: "1978-11-29", userLastActive: "1970-01-01T00:00:00.000Z", status: "pending", emailAddress: "x", statusLastUpdated: "" }],
    });
    dynamoMock.on(TransactWriteCommand).resolves({});
    const event: DynamoDBStreamEvent = { Records: [generateDynamoStreamRecord("test-client")] };
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
    const event: DynamoDBStreamEvent = { Records: [generateDynamoStreamRecord("test-client")] };
    await expect(handler(event, {} as Context)).rejects.toThrow(
      "Failed to update inactive account tracker for user qwerty"
    );
  });

  test("includes email and does not log warning when email exists on the event", async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [{ commonSubjectId: "qwerty", dateForDeletion: "1978-11-29", userLastActive: "1970-01-01T00:00:00.000Z", status: "pending", statusLastUpdated: "" }],
    });
    const recordWithEmail = {
      dynamodb: {
        NewImage: {
          event: {
            M: {
              client_id: { S: "test-client" },
              user: {
                M: {
                  user_id: { S: "qwerty" },
                  email: { S: "email@exists.uk" }
                }
              }
            }
          }
        }
      }
    };

    const event: DynamoDBStreamEvent = { Records: [recordWithEmail as DynamoDBRecord] };
    await handler(event, {} as Context);
    expect(dynamoMock).toHaveReceivedCommandWith(TransactWriteCommand, {
      TransactItems: expect.arrayContaining([
        expect.objectContaining({
          Put: expect.objectContaining({
            TableName: "test-table",
            Item: expect.objectContaining({ emailAddress: "email@exists.uk" }),
          }),
        }),
      ]),
    });
    expect(loggerWarnMock).not.toHaveBeenCalled();
  });

  test("logs warning when email is missing from the event and from pre-existing record", async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [{ commonSubjectId: "qwerty", dateForDeletion: "1978-11-29", userLastActive: "1970-01-01T00:00:00.000Z", status: "pending", statusLastUpdated: "" }],
    });
    const invalidRecord = {
      dynamodb: {
        NewImage: {
          event: {
            M: {
              client_id: { S: "test-client" },
              user: {
                M: {
                  user_id: { S: "qwerty" }
                }
              }
            }
          }
        }
      }
    };
    const event: DynamoDBStreamEvent = { Records: [invalidRecord as DynamoDBRecord] };
    await handler(event, {} as Context);
    expect(dynamoMock).toHaveReceivedCommandWith(TransactWriteCommand, {
      TransactItems: expect.arrayContaining([
        expect.objectContaining({
          Put: expect.objectContaining({
            TableName: "test-table",
            Item: expect.objectContaining({ commonSubjectId: "qwerty", emailAddress: "" }),
          }),
        }),
      ]),
    });
    expect(loggerWarnMock).toHaveBeenCalledWith("AUTH_EVENT_NO_EMAIL for userId qwerty");
  });

  test("stores publicSubjectId from event when present", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [] });
    dynamoMock.on(TransactWriteCommand).resolves({});
    const recordWithPublicSubjectId = {
      dynamodb: {
        NewImage: {
          event: {
            M: {
              event_id: { S: "event_id" },
              client_id: { S: "test-client" },
              timestamp: { N: `${timestamp}` },
              user: {
                M: {
                  user_id: { S: "qwerty" },
                  public_subject_id: { S: "public-subject-123" },
                },
              },
            },
          },
        },
      },
    };
    const event: DynamoDBStreamEvent = { Records: [recordWithPublicSubjectId as DynamoDBRecord] };
    await handler(event, {} as Context);
    expect(dynamoMock).toHaveReceivedCommandWith(TransactWriteCommand, {
      TransactItems: expect.arrayContaining([
        expect.objectContaining({
          Put: expect.objectContaining({
            Item: expect.objectContaining({ publicSubjectId: "public-subject-123" }),
          }),
        }),
      ]),
    });
  });

  test("falls back to publicSubjectId from existing tracker record when not on event", async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [{ commonSubjectId: "qwerty", dateForDeletion: "1978-11-29", userLastActive: "1970-01-01T00:00:00.000Z", emailAddress: "x", publicSubjectId: "public-subject-from-record", status: "pending", statusLastUpdated: "" }],
    });
    dynamoMock.on(TransactWriteCommand).resolves({});
    const recordWithoutPublicSubjectId = {
      dynamodb: {
        NewImage: {
          event: {
            M: {
              event_id: { S: "event_id" },
              client_id: { S: "test-client" },
              timestamp: { N: `${timestamp}` },
              user: { M: { user_id: { S: "qwerty" } } },
            },
          },
        },
      },
    };
    const event: DynamoDBStreamEvent = { Records: [recordWithoutPublicSubjectId as DynamoDBRecord] };
    await handler(event, {} as Context);
    expect(dynamoMock).toHaveReceivedCommandWith(TransactWriteCommand, {
      TransactItems: expect.arrayContaining([
        expect.objectContaining({
          Put: expect.objectContaining({
            Item: expect.objectContaining({ publicSubjectId: "public-subject-from-record" }),
          }),
        }),
      ]),
    });
  });

  test("omits publicSubjectId from tracker record when absent from both event and existing record", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [] });
    dynamoMock.on(TransactWriteCommand).resolves({});
    const recordWithoutPublicSubjectId = {
      dynamodb: {
        NewImage: {
          event: {
            M: {
              event_id: { S: "event_id" },
              client_id: { S: "test-client" },
              timestamp: { N: `${timestamp}` },
              user: { M: { user_id: { S: "qwerty" } } },
            },
          },
        },
      },
    };
    const event: DynamoDBStreamEvent = { Records: [recordWithoutPublicSubjectId as DynamoDBRecord] };
    await handler(event, {} as Context);
    expect(dynamoMock).toHaveReceivedCommandWith(TransactWriteCommand, {
      TransactItems: expect.arrayContaining([
        expect.objectContaining({
          Put: expect.objectContaining({
            Item: expect.not.objectContaining({ publicSubjectId: expect.anything() }),
          }),
        }),
      ]),
    });
  });

  test("logs warning when email is missing from the event but is present in pre-existing record", async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [{ commonSubjectId: "qwerty", dateForDeletion: "1978-11-29", userLastActive: "1970-01-01T00:00:00.000Z", emailAddress: "testing-warning@test.co", status: "pending", statusLastUpdated: "" }],
    });
    const invalidRecord = {
      dynamodb: {
        NewImage: {
          event: {
            M: {
              client_id: { S: "test-client" },
              user: {
                M: {
                  user_id: { S: "qwerty" }
                }
              }
            }
          }
        }
      }
    };
    const event: DynamoDBStreamEvent = { Records: [invalidRecord as DynamoDBRecord] };
    await handler(event, {} as Context);
    expect(dynamoMock).toHaveReceivedCommandWith(TransactWriteCommand, {
      TransactItems: expect.arrayContaining([
        expect.objectContaining({
          Put: expect.objectContaining({
            TableName: "test-table",
            Item: expect.objectContaining({ commonSubjectId: "qwerty", emailAddress: "testing-warning@test.co" }),
          }),
        }),
      ]),
    });
    expect(loggerWarnMock).toHaveBeenCalledWith("AUTH_EVENT_NO_EMAIL for userId qwerty");
  });
});
