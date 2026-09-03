import { vi, describe, test, expect, afterEach, beforeEach } from "vitest";
import { DynamoDBRecord, Context, DynamoDBStreamEvent, DynamoDBBatchResponse } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { getDaysUntilAccountWouldHaveBeenDeleted, handler } from "../update-inactive-account-tracker.js";
import { generateDynamoStreamRecord, timestamp, txmaEventId } from "./testFixtures.js";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs"; 
const dynamoMock = mockClient(DynamoDBDocumentClient);
const sqsMock = mockClient(SQSClient);

const mockMetrics = vi.hoisted(() => ({
  publishStoredMetrics: vi.fn(),
  addDimension: vi.fn(),
  addMetric: vi.fn(),
}));

const mockInitMetrics = vi.hoisted(() => vi.fn(() => mockMetrics));

vi.mock("../common/metrics.js", () => ({
  initMetrics: mockInitMetrics,
}));

vi.hoisted(() => {
  process.env.NOTIFY_TEMPLATE_IDS = '{"GLOBAL_LOGOUT":"template-id"}';
});

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
    process.env.NOTIFICATION_QUEUE_URL = "https://sqsq-url"; 
    process.env.NOTIFY_TEMPLATE_IDS = '{"GLOBAL_LOGOUT":"template-id"}';
    process.env.GOV_UK_APP_CLIENT_ID = 'govuk-app-client-id';
    process.env.SEND_INACTIVE_ACCOUNT_DELETION_EMAILS = '1';
    dynamoMock.reset();
    sqsMock.reset(); 
    vi.clearAllMocks();
  });

  afterEach(() => {
    loggerInfoMock.mockClear();
    loggerWarnMock.mockClear();
    delete process.env.INACTIVE_ACCOUNT_TRACKER_TABLE_NAME;
    delete process.env.USER_NOTIFICATIONS_TABLE_NAME;
    delete process.env.NOTIFY_TEMPLATE_IDS;
    delete process.env.OLH_CLIENT_ID;
    delete process.env.AUTH_BACKFILL_COMPLETE_DATETIME;
    delete process.env.NOTIFICATION_QUEUE_URL;
    delete process.env.GOV_UK_APP_CLIENT_ID;
    delete process.env.SEND_INACTIVE_ACCOUNT_DELETION_EMAILS;
  });

  test("queries CommonSubjectIdIndex with user_id", async () => {

    dynamoMock.on(QueryCommand).resolves({ Items: [] });
    dynamoMock.on(TransactWriteCommand).resolves({});
    const event: DynamoDBStreamEvent = { Records: [generateDynamoStreamRecord("test-client")] };
    const result = await handler(event, {} as Context);
    expect(result).toEqual<DynamoDBBatchResponse>({ batchItemFailures: [] });
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
    const result = await handler(event, {} as Context);
    expect(result).toEqual<DynamoDBBatchResponse>({ batchItemFailures: [] });
    expect(dynamoMock).toHaveReceivedCommandWith(TransactWriteCommand, {
      TransactItems: expect.arrayContaining([
        expect.objectContaining({
          Put: expect.objectContaining({
            TableName: "test-table",
            Item: expect.objectContaining({ commonSubjectId: "qwerty", status: "pending", userLastActiveSource: "AUTH_AUTH_CODE_ISSUED", userLastActiveSourceId: "event_id", emailAddressSource: "AUTH_AUTH_CODE_ISSUED", emailAddressSourceId: "event_id" }),
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
    expect(loggerWarnMock).toHaveBeenCalledWith("AUTH_EVENT_ON_DELETING_ACCOUNT");
    expect(dynamoMock).not.toHaveReceivedCommand(TransactWriteCommand);
  });

  test("returns failed record in batchItemFailures when more than one tracker record exists", async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [
        { commonSubjectId: "qwerty", dateForDeletion: "2026-01-01", userLastActive: "2026-01-01T00:00:00.000Z", status: "pending", emailAddress: "x", statusLastUpdated: "" },
        { commonSubjectId: "qwerty", dateForDeletion: "2026-01-02", userLastActive: "2026-01-02T00:00:00.000Z", status: "pending", emailAddress: "x", statusLastUpdated: "" },
      ],
    });
    const record = generateDynamoStreamRecord("test-client");
    record.dynamodb!.SequenceNumber = "1234567890";
    const event: DynamoDBStreamEvent = { Records: [record] };
    const result = await handler(event, {} as Context);
    expect(result).toEqual<DynamoDBBatchResponse>({ batchItemFailures: [{ itemIdentifier: "1234567890" }] });
  });

  test("does not delete from user notifications table when client_id matches OLH client", async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [{ commonSubjectId: "qwerty", dateForDeletion: "2026-01-01", userLastActive: "2020-01-01T00:00:00.000Z", status: "pending", emailAddress: "x", statusLastUpdated: "" }],
    });
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

  test("deletes from user notifications table when client_id does not match OLH client", async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [{ commonSubjectId: "qwerty", dateForDeletion: "2026-01-01", userLastActive: "2020-01-01T00:00:00.000Z", status: "pending", emailAddress: "x", statusLastUpdated: "" }],
    });
    dynamoMock.on(TransactWriteCommand).resolves({});
    const event: DynamoDBStreamEvent = { Records: [generateDynamoStreamRecord("some-other-rp")] };
    await handler(event, {} as Context);
    expect(dynamoMock).toHaveReceivedCommandWith(TransactWriteCommand, {
      TransactItems: expect.arrayContaining([
        expect.objectContaining({
          Delete: expect.objectContaining({
            TableName: "user-notifications-table",
            Key: { internalCommonSubjectId: "qwerty" },
          }),
        }),
      ]),
    });
  });

  test("returns early and logs info when AUTH_CODE_VERIFIED event has no user_id", async () => {
    const record = {
      dynamodb: {
        NewImage: {
          event: {
            M: {
              event_name: { S: "AUTH_CODE_VERIFIED" },
              timestamp: { N: "1711929600" },
            },
          },
        },
      },
    };
    const event: DynamoDBStreamEvent = { Records: [record as DynamoDBRecord] };
    await handler(event, {} as Context);
    expect(loggerInfoMock).toHaveBeenCalledWith("Ignoring AUTH_CODE_VERIFIED event with missing user.user_id");
    expect(dynamoMock).not.toHaveReceivedCommand(TransactWriteCommand);
  });

  test("returns early and logs info when AUTH_CODE_VERIFIED event has PASSWORD_RESET journey type", async () => {
    const record = {
      dynamodb: {
        NewImage: {
          event: {
            M: {
              event_name: { S: "AUTH_CODE_VERIFIED" },
              timestamp: { N: "1711929600" },
              user: { M: { user_id: { S: "qwerty" } } },
              extensions: { M: { "journey-type": { S: "PASSWORD_RESET" } } },
            },
          },
        },
      },
    };
    const event: DynamoDBStreamEvent = { Records: [record as DynamoDBRecord] };
    await handler(event, {} as Context);
    expect(loggerInfoMock).toHaveBeenCalledWith(`Ignoring AUTH_CODE_VERIFIED event with extensions["journey-type"] of PASSWORD_RESET`);
    expect(dynamoMock).not.toHaveReceivedCommand(TransactWriteCommand);
  });

  test("sets hasSetupMfa to false when no existing record", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [] });
    dynamoMock.on(TransactWriteCommand).resolves({});
    const event: DynamoDBStreamEvent = { Records: [generateDynamoStreamRecord("test-client")] };
    await handler(event, {} as Context);
    expect(dynamoMock).toHaveReceivedCommandWith(TransactWriteCommand, {
      TransactItems: expect.arrayContaining([
        expect.objectContaining({
          Put: expect.objectContaining({
            Item: expect.objectContaining({ hasSetupMfa: false }),
          }),
        }),
      ]),
    });
  });

  test("preserves hasSetupMfa from existing record", async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [{ commonSubjectId: "qwerty", dateForDeletion: "1978-11-29", userLastActive: "1970-01-01T00:00:00.000Z", status: "pending", emailAddress: "x", statusLastUpdated: "", hasSetupMfa: true }],
    });
    dynamoMock.on(TransactWriteCommand).resolves({});
    const event: DynamoDBStreamEvent = { Records: [generateDynamoStreamRecord("test-client")] };
    await handler(event, {} as Context);
    expect(dynamoMock).toHaveReceivedCommandWith(TransactWriteCommand, {
      TransactItems: expect.arrayContaining([
        expect.objectContaining({
          Put: expect.objectContaining({
            Item: expect.objectContaining({ hasSetupMfa: true }),
          }),
        }),
      ]),
    });
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

  test("returns failed record in batchItemFailures when transaction fails", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [] });
    dynamoMock.on(TransactWriteCommand).rejects(new Error("TransactionCanceledException"));
    const record = generateDynamoStreamRecord("test-client");
    record.dynamodb!.SequenceNumber = "1234567890";
    const event: DynamoDBStreamEvent = { Records: [record] };
    const result = await handler(event, {} as Context);
    expect(result).toEqual<DynamoDBBatchResponse>({ batchItemFailures: [{ itemIdentifier: "1234567890" }] });
  });

  test("returns only failed records in batchItemFailures when one record in a batch fails", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [] });
    dynamoMock.on(TransactWriteCommand)
      .resolvesOnce({})
      .rejectsOnce(new Error("TransactionCanceledException"))
      .resolvesOnce({});

    const record1 = generateDynamoStreamRecord("test-client");
    record1.dynamodb!.SequenceNumber = "111";
    const record2 = generateDynamoStreamRecord("test-client");
    record2.dynamodb!.SequenceNumber = "222";
    const record3 = generateDynamoStreamRecord("test-client");
    record3.dynamodb!.SequenceNumber = "333";

    const event: DynamoDBStreamEvent = { Records: [record1, record2, record3] };
    const result = await handler(event, {} as Context);
    expect(result).toEqual<DynamoDBBatchResponse>({ batchItemFailures: [{ itemIdentifier: "222" }] });
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
              timestamp: { N: "1711929600" },
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

  test("logs warning when email is missing from the event and from pre-existing record, and omits emailAddress from record", async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [{ commonSubjectId: "qwerty", dateForDeletion: "1978-11-29", userLastActive: "1970-01-01T00:00:00.000Z", status: "pending", statusLastUpdated: "" }],
    });
    const invalidRecord = {
      dynamodb: {
        NewImage: {
          event: {
            M: {
              client_id: { S: "test-client" },
              timestamp: { N: "1711929600" },
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
            Item: expect.not.objectContaining({ emailAddress: expect.anything() }),
          }),
        }),
      ]),
    });
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

  test("sets publicSubjectId to empty string when absent from both event and existing record", async () => {
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
            Item: expect.objectContaining({ publicSubjectId: "" }),
          }),
        }),
      ]),
    });
  });

  test("preserves emailAddressSource and emailAddressSourceId from existing record when email is unchanged", async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [{ commonSubjectId: "qwerty", dateForDeletion: "1978-11-29", userLastActive: "1970-01-01T00:00:00.000Z", emailAddress: "foo@bar.com", emailAddressSource: "AUTH_PREVIOUS_EVENT", emailAddressSourceId: "old-event-id", emailAddressLastUpdated: "2020-01-01T00:00:00.000Z", status: "pending", statusLastUpdated: "" }],
    });
    dynamoMock.on(TransactWriteCommand).resolves({});
    // generateDynamoStreamRecord includes email: "foo@bar.com" which matches the existing record
    const event: DynamoDBStreamEvent = { Records: [generateDynamoStreamRecord("test-client")] };
    await handler(event, {} as Context);
    expect(dynamoMock).toHaveReceivedCommandWith(TransactWriteCommand, {
      TransactItems: expect.arrayContaining([
        expect.objectContaining({
          Put: expect.objectContaining({
            Item: expect.objectContaining({
              emailAddress: "foo@bar.com",
              emailAddressSource: "AUTH_PREVIOUS_EVENT",
              emailAddressSourceId: "old-event-id",
              emailAddressLastUpdated: "2020-01-01T00:00:00.000Z",
            }),
          }),
        }),
      ]),
    });
  });

  test("updates emailAddressSource, emailAddressSourceId and emailAddressLastUpdated when email changes", async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [{ commonSubjectId: "qwerty", dateForDeletion: "1978-11-29", userLastActive: "1970-01-01T00:00:00.000Z", emailAddress: "old@email.com", emailAddressSource: "AUTH_PREVIOUS_EVENT", emailAddressSourceId: "old-event-id", emailAddressLastUpdated: "1970-01-01T00:00:00.000Z", status: "pending", statusLastUpdated: "" }],
    });
    dynamoMock.on(TransactWriteCommand).resolves({});
    // generateDynamoStreamRecord uses timestamp = 123456789 seconds => 1973-11-29T21:33:09.000Z
    const expectedEventDateTime = new Date(timestamp * 1000).toISOString();
    const event: DynamoDBStreamEvent = { Records: [generateDynamoStreamRecord("test-client")] };
    await handler(event, {} as Context);
    expect(dynamoMock).toHaveReceivedCommandWith(TransactWriteCommand, {
      TransactItems: expect.arrayContaining([
        expect.objectContaining({
          Put: expect.objectContaining({
            Item: expect.objectContaining({
              emailAddress: "foo@bar.com",
              emailAddressSource: "AUTH_AUTH_CODE_ISSUED",
              emailAddressSourceId: txmaEventId,
              emailAddressLastUpdated: expectedEventDateTime,
            }),
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
              timestamp: { N: "1711929600" },
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
  });

  test("uses event_timestamp_ms for eventDateTime when present", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [] });
    dynamoMock.on(TransactWriteCommand).resolves({});
    const msTimestamp = 1711929600123;
    const streamRecord = generateDynamoStreamRecord("test-client");
    if (streamRecord.dynamodb?.NewImage?.event?.M) {
      streamRecord.dynamodb.NewImage.event.M.event_timestamp_ms = { N: msTimestamp.toString() };
    }
    const event: DynamoDBStreamEvent = { Records: [streamRecord] };
    await handler(event, {} as Context);
    expect(dynamoMock).toHaveReceivedCommandWith(TransactWriteCommand, {
      TransactItems: expect.arrayContaining([
        expect.objectContaining({
          Put: expect.objectContaining({
            Item: expect.objectContaining({ statusLastUpdated: new Date(msTimestamp).toISOString() }),
          }),
        }),
      ]),
    });
  });

  test("sets statusLastUpdated to the event timestamp", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [] });
    dynamoMock.on(TransactWriteCommand).resolves({});
    const expectedEventDateTime = new Date(timestamp * 1000).toISOString();
    const event: DynamoDBStreamEvent = { Records: [generateDynamoStreamRecord("test-client")] };
    await handler(event, {} as Context);
    expect(dynamoMock).toHaveReceivedCommandWith(TransactWriteCommand, {
      TransactItems: expect.arrayContaining([
        expect.objectContaining({
          Put: expect.objectContaining({
            Item: expect.objectContaining({ statusLastUpdated: expectedEventDateTime }),
          }),
        }),
      ]),
    });
  });

  test("sets userLastActiveUpdated to the event timestamp when event is newer", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [] });
    dynamoMock.on(TransactWriteCommand).resolves({});
    const expectedEventDateTime = new Date(timestamp * 1000).toISOString();
    const event: DynamoDBStreamEvent = { Records: [generateDynamoStreamRecord("test-client")] };
    await handler(event, {} as Context);
    expect(dynamoMock).toHaveReceivedCommandWith(TransactWriteCommand, {
      TransactItems: expect.arrayContaining([
        expect.objectContaining({
          Put: expect.objectContaining({
            Item: expect.objectContaining({ userLastActiveUpdated: expectedEventDateTime }),
          }),
        }),
      ]),
    });
  });

  test("preserves userLastActiveUpdated from existing record when event is older", async () => {
    const existingLastActiveUpdated = "2099-01-01T00:00:00.000Z";
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    dynamoMock.on(QueryCommand).resolves({
      Items: [{ commonSubjectId: "qwerty", dateForDeletion: "2099-01-01", userLastActive: futureDate, userLastActiveUpdated: existingLastActiveUpdated, status: "pending", emailAddress: "x", statusLastUpdated: "" }],
    });
    dynamoMock.on(TransactWriteCommand).resolves({});
    const event: DynamoDBStreamEvent = { Records: [generateDynamoStreamRecord("test-client")] };
    await handler(event, {} as Context);
    expect(dynamoMock).toHaveReceivedCommandWith(TransactWriteCommand, {
      TransactItems: expect.arrayContaining([
        expect.objectContaining({
          Put: expect.objectContaining({
            Item: expect.objectContaining({ userLastActiveUpdated: existingLastActiveUpdated }),
          }),
        }),
      ]),
    });
  });

  test("converts historic millisecond timestamps to seconds", async () => {
    const msTimestamp = 1711929600000; 
    const expectedLastActive = "2024-04-01T00:00:00.000Z";
    const expectedDeletionDate = "2029-04-01";

    const streamRecord = generateDynamoStreamRecord("test-client");
    if (streamRecord.dynamodb?.NewImage?.event?.M) {
      streamRecord.dynamodb.NewImage.event.M.timestamp = { N: msTimestamp.toString() };
    }

    dynamoMock.on(QueryCommand).resolves({ Items: [] });
    dynamoMock.on(TransactWriteCommand).resolves({});

    const event: DynamoDBStreamEvent = { Records: [streamRecord] };
    await handler(event, {} as Context);

    expect(dynamoMock).toHaveReceivedCommandWith(TransactWriteCommand, {
      TransactItems: expect.arrayContaining([
        expect.objectContaining({
          Put: expect.objectContaining({
            TableName: "test-table",
            Item: expect.objectContaining({ 
              userLastActive: expectedLastActive,
              dateForDeletion: expectedDeletionDate
            }),
          }),
        }),
      ]),
    });
  });

  test("leaves valid second-based timestamps untouched", async () => {
    const secondsTimestamp = 1711929600; 
    const expectedLastActive = "2024-04-01T00:00:00.000Z";

    const streamRecord = generateDynamoStreamRecord("test-client");
    if (streamRecord.dynamodb?.NewImage?.event?.M) {
      streamRecord.dynamodb.NewImage.event.M.timestamp = { N: secondsTimestamp.toString() };
    }

    dynamoMock.on(QueryCommand).resolves({ Items: [] });
    dynamoMock.on(TransactWriteCommand).resolves({});

    const event: DynamoDBStreamEvent = { Records: [streamRecord] };
    await handler(event, {} as Context);

    expect(dynamoMock).toHaveReceivedCommandWith(TransactWriteCommand, {
      TransactItems: expect.arrayContaining([
        expect.objectContaining({
          Put: expect.objectContaining({
            Item: expect.objectContaining({ 
              userLastActive: expectedLastActive 
            }),
          }),
        }),
      ]),
    });
  });

  test("updates email address when event timestamp is newer than emailAddressLastUpdated", async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [{ 
        commonSubjectId: "asdf", 
        dateForDeletion: "1975-01-01", 
        userLastActive: "1970-01-01T00:16:40.000Z", 
        status: "pending", 
        emailAddress: "old-email@example.com", 
        emailAddressLastUpdated: "1970-01-01T00:16:40.000Z",
        statusLastUpdated: "" 
      }],
    });
    dynamoMock.on(TransactWriteCommand).resolves({});

    const event: DynamoDBStreamEvent = { Records: [generateDynamoStreamRecord("test-client")] };
    if (event.Records[0].dynamodb?.NewImage?.event?.M) {
      event.Records[0].dynamodb.NewImage.event.M.timestamp = { N: "1666769858" };
      event.Records[0].dynamodb.NewImage.event.M.event_name = { S: "NEWER_EMAIL_EVENT" };
      event.Records[0].dynamodb.NewImage.event.M.event_id = { S: "newre" };
      event.Records[0].dynamodb.NewImage.event.M.user = { 
        M: { 
          user_id: { S: "test_id" }, 
          email: { S: "test_newer_email@example.com" } 
        } 
      };
    }

    await handler(event, {} as Context);

    expect(dynamoMock).toHaveReceivedCommandWith(TransactWriteCommand, {
      TransactItems: expect.arrayContaining([
        expect.objectContaining({
          Put: expect.objectContaining({
            Item: expect.objectContaining({ 
              emailAddress: "test_newer_email@example.com",
              emailAddressSource: "NEWER_EMAIL_EVENT",
              emailAddressSourceId: "newre",
              emailAddressLastUpdated: "2022-10-26T07:37:38.000Z"
            }),
          }),
        }),
      ]),
    });
  });

  test("does not update email address when event timestamp is older than emailAddressLastUpdated", async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [{ 
        commonSubjectId: "asdf", 
        dateForDeletion: "1975-01-01", 
        userLastActive: "1970-01-01T00:33:20.000Z", 
        status: "pending", 
        emailAddress: "current-and-newest-email@example.com", 
        emailAddressSource: "FRESH_EVENT",
        emailAddressSourceId: "current-and-newestest",
        emailAddressLastUpdated: "1970-01-01T00:33:20.000Z",
        statusLastUpdated: "" 
      }],
    });
    dynamoMock.on(TransactWriteCommand).resolves({});

    const event: DynamoDBStreamEvent = { Records: [generateDynamoStreamRecord("test-client")] };
    
    if (event.Records[0].dynamodb?.NewImage?.event?.M) {
      event.Records[0].dynamodb.NewImage.event.M.timestamp = { N: "1000" };
      event.Records[0].dynamodb.NewImage.event.M.event_name = { S: "STALE_OUT_OF_ORDER_EVENT" };
      event.Records[0].dynamodb.NewImage.event.M.event_id = { S: "stale_id" };
      event.Records[0].dynamodb.NewImage.event.M.user = { 
        M: { 
          user_id: { S: "asdf" }, 
          email: { S: "old-email@example.com" } 
        } 
      };
    }

    await handler(event, {} as Context);

    expect(dynamoMock).toHaveReceivedCommandWith(TransactWriteCommand, {
      TransactItems: expect.arrayContaining([
        expect.objectContaining({
          Put: expect.objectContaining({
            Item: expect.objectContaining({ 
              emailAddress: "current-and-newest-email@example.com",
              emailAddressSource: "FRESH_EVENT",
              emailAddressSourceId: "current-and-newestest",
              emailAddressLastUpdated: "1970-01-01T00:33:20.000Z"
            }),
          }),
        }),
      ]),
    });
  });

  test("sends INACTIVE_ACCOUNT_SAVED_APP to SQS when user is within 30 days of deletion and logs in via App", async () => {
    const within30DaysDate = new Date();
    within30DaysDate.setDate(within30DaysDate.getDate() + 15);
    const dateStr = within30DaysDate.toISOString().split("T")[0];

    dynamoMock.on(QueryCommand).resolves({
      Items: [{ 
        commonSubjectId: "qwerty", 
        dateForDeletion: dateStr, 
        userLastActive: new Date(Date.now() - 100000).toISOString(), 
        status: "pending", 
        emailAddress: "user@example.com" 
      }],
    });
    dynamoMock.on(TransactWriteCommand).resolves({});
    sqsMock.on(SendMessageCommand).resolves({});

    const event: DynamoDBStreamEvent = { 
      Records: [generateDynamoStreamRecord("govuk-app-client-id")] 
    };

    await handler(event, {} as Context);

    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl: "https://sqsq-url",
      MessageBody: JSON.stringify({
        notificationType: "INACTIVE_ACCOUNT_SAVED_APP",
        emailAddress: "foo@bar.com"
      }),
    });
    expect(loggerInfoMock).toHaveBeenCalledWith(
      "Account saved message successfully sent to target queue",
      {
        publicSubjectId: "public-subject-id-123",
        notificationType: "INACTIVE_ACCOUNT_SAVED_APP",
      }
    );
  });

  test("sends INACTIVE_ACCOUNT_SAVED_HOME to SQS when user is within 30 days of deletion and logs in via Home", async () => {
    const within30DaysDate = new Date();
    within30DaysDate.setDate(within30DaysDate.getDate() + 15);
    const dateStr = within30DaysDate.toISOString().split("T")[0];

    dynamoMock.on(QueryCommand).resolves({
      Items: [{ 
        commonSubjectId: "qwerty", 
        dateForDeletion: dateStr, 
        userLastActive: new Date(Date.now() - 100000).toISOString(), 
        status: "pending", 
        emailAddress: "user@example.com" 
      }],
    });
    dynamoMock.on(TransactWriteCommand).resolves({});
    sqsMock.on(SendMessageCommand).resolves({});

    const event: DynamoDBStreamEvent = { 
      Records: [generateDynamoStreamRecord("test-client")] 
    };

    await handler(event, {} as Context);

    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl: "https://sqsq-url",
      MessageBody: JSON.stringify({
        notificationType: "INACTIVE_ACCOUNT_SAVED_HOME",
        emailAddress: "foo@bar.com",
      }),
    });

    expect(loggerInfoMock).toHaveBeenCalledWith(
      "Account saved message successfully sent to target queue",
      {
        publicSubjectId: "public-subject-id-123",
        notificationType: "INACTIVE_ACCOUNT_SAVED_HOME",
      }
    );
  });

  test("sends INACTIVE_ACCOUNT_SAVED_RP to SQS when user is within 30 days of deletion and logs in via an RP that is not GOVUK App or OLH", async () => {
    const within30DaysDate = new Date();
    within30DaysDate.setDate(within30DaysDate.getDate() + 15);
    const dateStr = within30DaysDate.toISOString().split("T")[0];

    dynamoMock.on(QueryCommand).resolves({
      Items: [{ 
        commonSubjectId: "qwerty", 
        dateForDeletion: dateStr, 
        userLastActive: new Date(Date.now() - 100000).toISOString(), 
        status: "pending", 
        emailAddress: "user@example.com" 
      }],
    });
    dynamoMock.on(TransactWriteCommand).resolves({});
    sqsMock.on(SendMessageCommand).resolves({});

    const event: DynamoDBStreamEvent = { 
      Records: [generateDynamoStreamRecord("client-id")] 
    };

    await handler(event, {} as Context);

    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl: "https://sqsq-url",
      MessageBody: JSON.stringify({
        notificationType: "INACTIVE_ACCOUNT_SAVED_RP",
        emailAddress: "foo@bar.com",
      }),
    });

    expect(loggerInfoMock).toHaveBeenCalledWith(
      "Account saved message successfully sent to target queue",
      {
        publicSubjectId: "public-subject-id-123",
        notificationType: "INACTIVE_ACCOUNT_SAVED_RP",
      }
    );
  });

  test("logs warning when no email address and deletion date is within 30 days", async () => {
    const within30DaysDate = new Date();
    within30DaysDate.setDate(within30DaysDate.getDate() + 15);
    const dateStr = within30DaysDate.toISOString().split("T")[0];

    dynamoMock.on(QueryCommand).resolves({
      Items: [{ 
        commonSubjectId: "qwerty", 
        dateForDeletion: dateStr, 
        userLastActive: new Date(Date.now() - 100000).toISOString(), 
        status: "pending",
      }],
    });
    dynamoMock.on(TransactWriteCommand).resolves({});

    const recordWithoutEmail = {
      dynamodb: {
        NewImage: {
          event: {
            M: {
              client_id: { S: "test-client" },
              timestamp: { N: `${Math.floor(Date.now() / 1000) - 1}` },
              user: { M: { user_id: { S: "qwerty" } } },
            },
          },
        },
      },
    };
    const event: DynamoDBStreamEvent = { Records: [recordWithoutEmail as DynamoDBRecord] };
    await handler(event, {} as Context);

    expect(sqsMock).not.toHaveReceivedCommand(SendMessageCommand);
    expect(loggerWarnMock).toHaveBeenCalledWith("INACTIVE_ACCOUNT_SAVED_BUT_NO_EMAIL_ADDRESS_TO_NOTIFY");
  });

  test("does not send SQS message when newItem has no emailAddress, even if deletion date is within 30 days", async () => {
    const within30DaysDate = new Date();
    within30DaysDate.setDate(within30DaysDate.getDate() + 15);
    const dateStr = within30DaysDate.toISOString().split("T")[0];

    dynamoMock.on(QueryCommand).resolves({
      Items: [{ 
        commonSubjectId: "qwerty", 
        dateForDeletion: dateStr, 
        userLastActive: new Date(Date.now() - 100000).toISOString(), 
        status: "pending",
        // no emailAddress on existing record
      }],
    });
    dynamoMock.on(TransactWriteCommand).resolves({});
    sqsMock.on(SendMessageCommand).resolves({});

    // event also has no email
    const recordWithoutEmail = {
      dynamodb: {
        NewImage: {
          event: {
            M: {
              client_id: { S: "test-client" },
              timestamp: { N: `${Math.floor(Date.now() / 1000) - 1}` },
              user: { M: { user_id: { S: "qwerty" } } },
            },
          },
        },
      },
    };
    const event: DynamoDBStreamEvent = { Records: [recordWithoutEmail as DynamoDBRecord] };
    await handler(event, {} as Context);

    expect(sqsMock).not.toHaveReceivedCommand(SendMessageCommand);
  });

  test("does not send message when deletion date is too far in the future", async () => {
    const outside30DaysDate = new Date();
    outside30DaysDate.setDate(outside30DaysDate.getDate() + 45);
    const dateStr = outside30DaysDate.toISOString().split("T")[0];

    dynamoMock.on(QueryCommand).resolves({
      Items: [{ 
        commonSubjectId: "qwerty", 
        dateForDeletion: dateStr, 
        userLastActive: new Date(Date.now() - 100000).toISOString(), 
        status: "pending", 
        emailAddress: "foo@bar.com" 
      }],
    });
    dynamoMock.on(TransactWriteCommand).resolves({});
    sqsMock.on(SendMessageCommand).resolves({});

    const event: DynamoDBStreamEvent = { 
      Records: [generateDynamoStreamRecord("EznkQXGrWxi0cQMSACY15UzvG1Q")] 
    };

    await handler(event, {} as Context);

    expect(sqsMock).not.toHaveReceivedCommand(SendMessageCommand);
  });

  test("does not send message when inactive account deletion emails feature flag is off", async () => {
    const within30DaysDate = new Date();
    within30DaysDate.setDate(within30DaysDate.getDate() + 15);
    const dateStr = within30DaysDate.toISOString().split("T")[0];
    process.env.SEND_INACTIVE_ACCOUNT_DELETION_EMAILS = '0';

    dynamoMock.on(QueryCommand).resolves({
      Items: [{ 
        commonSubjectId: "qwerty", 
        dateForDeletion: dateStr, 
        userLastActive: new Date(Date.now() - 100000).toISOString(), 
        status: "pending", 
        emailAddress: "foo@bar.com" 
      }],
    });
    sqsMock.on(SendMessageCommand).resolves({});

    const event: DynamoDBStreamEvent = { 
      Records: [generateDynamoStreamRecord("EznkQXGrWxi0cQMSACY15UzvG1Q")] 
    };

    await handler(event, {} as Context);

    expect(sqsMock).not.toHaveReceivedCommand(SendMessageCommand);
  });

  test("publishes DaysUntilAccountWouldHaveBeenDeleted metric when a previous dateForDeletion exists", async () => {
    vi.useFakeTimers();
    const systemNow = new Date("2026-09-02T12:12:30.000Z");
    vi.setSystemTime(systemNow);

    const targetDeletionDate = new Date(systemNow);
    targetDeletionDate.setDate(targetDeletionDate.getDate() + 10);

    dynamoMock.on(QueryCommand).resolves({ 
      Items: [{
        commonSubjectId: "qwerty",
        status: "pending",
        dateForDeletion: targetDeletionDate.toISOString(),
        userLastActive: "1970-01-01T00:16:40.000Z", 
        emailAddress: "old-email@example.com", 
        emailAddressLastUpdated: "1970-01-01T00:16:40.000Z",
        statusLastUpdated: "" 
      }] 
    });
    dynamoMock.on(TransactWriteCommand).resolves({});

    const event: DynamoDBStreamEvent = { 
      Records: [generateDynamoStreamRecord("test-client")] 
    };

    await handler(event, {} as Context);

    expect(mockMetrics.addDimension).toHaveBeenCalledWith(
      "previousInactiveAccountRecordStatus",
      "pending"
    );
    expect(mockMetrics.addDimension).toHaveBeenCalledWith(
      "clientIdOfAuditEventThatResetDeletionDate",
      "test-client"
    );
    
    expect(mockMetrics.addMetric).toHaveBeenCalledWith(
      "DaysUntilAccountWouldHaveBeenDeleted",
      "Count",
      10
    );
    expect(mockMetrics.publishStoredMetrics).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  describe("backfill threshold", () => {
    // timestamp fixture = 123456789 seconds = 1973-11-29T21:33:09.000Z
    const beforeThreshold = "1974-01-01T00:00:00.000Z";
    const afterThreshold = "1973-01-01T00:00:00.000Z";

    test("skips event before threshold when no existing record", async () => {
      process.env.AUTH_BACKFILL_COMPLETE_DATETIME = beforeThreshold;
      dynamoMock.on(QueryCommand).resolves({ Items: [] });
      const event: DynamoDBStreamEvent = { Records: [generateDynamoStreamRecord("test-client")] };
      await handler(event, {} as Context);
      expect(dynamoMock).not.toHaveReceivedCommand(TransactWriteCommand);
      expect(loggerInfoMock).toHaveBeenCalledWith("BACKFILL_EVENT_SKIPPED_NO_EXISTING_RECORD");
    });

    test("updates existing record when event is before threshold", async () => {
      process.env.AUTH_BACKFILL_COMPLETE_DATETIME = beforeThreshold;
      dynamoMock.on(QueryCommand).resolves({
        Items: [{ commonSubjectId: "qwerty", dateForDeletion: "1978-11-29", userLastActive: "1970-01-01T00:00:00.000Z", status: "pending", emailAddress: "x", statusLastUpdated: "" }],
      });
      dynamoMock.on(TransactWriteCommand).resolves({});
      const event: DynamoDBStreamEvent = { Records: [generateDynamoStreamRecord("test-client")] };
      await handler(event, {} as Context);
      expect(dynamoMock).toHaveReceivedCommand(TransactWriteCommand);
    });

    test("creates new record when event is after threshold and no existing record", async () => {
      process.env.AUTH_BACKFILL_COMPLETE_DATETIME = afterThreshold;
      dynamoMock.on(QueryCommand).resolves({ Items: [] });
      dynamoMock.on(TransactWriteCommand).resolves({});
      const event: DynamoDBStreamEvent = { Records: [generateDynamoStreamRecord("test-client")] };
      await handler(event, {} as Context);
      expect(dynamoMock).toHaveReceivedCommand(TransactWriteCommand);
    });

    test("creates new record when threshold is not configured", async () => {
      process.env.AUTH_BACKFILL_COMPLETE_DATETIME = "";
      dynamoMock.on(QueryCommand).resolves({ Items: [] });
      dynamoMock.on(TransactWriteCommand).resolves({});
      const event: DynamoDBStreamEvent = { Records: [generateDynamoStreamRecord("test-client")] };
      await handler(event, {} as Context);
      expect(dynamoMock).toHaveReceivedCommand(TransactWriteCommand);
    });
  });

  describe("getDaysUntilAccountWouldHaveBeenDeleted function", () => {
    const NOW = new Date("2026-09-02T12:30:00.000Z");

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test("should return 0 when the deletion date is today", () => {
      const deletionDate = "2026-09-02";
      const result = getDaysUntilAccountWouldHaveBeenDeleted(deletionDate);
      expect(result).toBe(0);
    });

    test("should return a positive integer when the deletion date is in the future", () => {
      const deletionDate = "2026-09-12";
      const result = getDaysUntilAccountWouldHaveBeenDeleted(deletionDate);
      expect(result).toBe(10);
    });

    test("should return a negative integer when the deletion date is in the past", () => {
      // this one shouldn't technically be possible as the account would have been deleted in the meanwhile, so it could potentially mean somethingg has gone wrong
      const deletionDate = "2026-08-28";
      const result = getDaysUntilAccountWouldHaveBeenDeleted(deletionDate);
      expect(result).toBe(-5);
    });

    test("should ignore time of day differences", () => {
      const deletionDate = "2026-09-03"; 
      const result = getDaysUntilAccountWouldHaveBeenDeleted(deletionDate);
      expect(result).toBe(1);
    });
  });
});
