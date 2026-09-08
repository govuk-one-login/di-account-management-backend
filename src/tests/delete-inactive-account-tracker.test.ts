import { vi, describe, test, expect, beforeEach, afterEach } from "vitest";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { mockClient } from "aws-sdk-client-mock";
import {
  handler,
  validateUserData,
  deleteUserData,
  maybeEnqueueDeletionEmail,
} from "../delete-inactive-account-tracker.js";

import {
  TEST_SNS_EVENT_WITH_TWO_RECORDS,
  TEST_USER_DATA,
  createSnsEvent,
} from "./testFixtures.js";
import { Context } from "aws-lambda";

const dynamoMock = mockClient(DynamoDBDocumentClient);
const sqsMock = mockClient(SQSClient);

const mockIsUserIdBlocked = vi.hoisted(() => vi.fn());
vi.mock("../common/account-interventions-service-client.js", () => ({
  isUserIdBlocked: mockIsUserIdBlocked,
}));

const aisNotSuspended = false;
const aisSuspended = true;

const trackerItem = { dateForDeletion: "2030-01-01", commonSubjectId: "user-id", emailAddress: "user@example.com", hasUndeliverableEmailAddress: false };

describe("deleteUserData", () => {
  beforeEach(() => {
    dynamoMock.reset();
    process.env.TABLE_NAME = "TABLE_NAME";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("queries the GSI and deletes matching records", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [trackerItem] });

    await deleteUserData(TEST_USER_DATA);

    expect(dynamoMock).toHaveReceivedCommandWith(QueryCommand, {
      TableName: "TABLE_NAME",
      IndexName: "CommonSubjectIdIndex",
      KeyConditionExpression: "commonSubjectId = :uid",
      ExpressionAttributeValues: { ":uid": TEST_USER_DATA.user_id },
    });
    expect(dynamoMock).toHaveReceivedCommandWith(DeleteCommand, {
      TableName: "TABLE_NAME",
      Key: { dateForDeletion: "2030-01-01", commonSubjectId: "user-id" },
    });
  });

  test("returns deleted: false when no records found", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [] });

    const result = await deleteUserData(TEST_USER_DATA);

    expect(result).toEqual({ deleted: false });
    expect(dynamoMock.commandCalls(DeleteCommand).length).toEqual(0);
  });

  test("returns deleted: true with emailAddress and hasUndeliverableEmailAddress from first item", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [trackerItem] });

    const result = await deleteUserData(TEST_USER_DATA);

    expect(result).toEqual({
      deleted: true,
      emailAddress: "user@example.com",
      hasUndeliverableEmailAddress: false,
    });
  });

  test("deletes multiple records when query returns many", async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [
        { dateForDeletion: "2030-01-01", commonSubjectId: "user-id" },
        { dateForDeletion: "2031-01-01", commonSubjectId: "user-id" },
      ],
    });

    await deleteUserData(TEST_USER_DATA);

    expect(dynamoMock.commandCalls(DeleteCommand).length).toEqual(2);
  });
});

describe("maybeEnqueueDeletionEmail", () => {
  beforeEach(() => {
    sqsMock.reset();
    dynamoMock.reset();
    process.env.NOTIFICATION_QUEUE_URL = "https://sqs.example.com/notification";
    process.env.AWS_REGION = "eu-west-2";
    mockIsUserIdBlocked.mockResolvedValue(aisNotSuspended);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("enqueues email when user is not blocked and email is deliverable", async () => {
    sqsMock.on(SendMessageCommand).resolves({});

    await maybeEnqueueDeletionEmail("user-id", "user@example.com", false);

    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl: "https://sqs.example.com/notification",
      MessageBody: JSON.stringify({
        notificationType: "INACTIVE_ACCOUNT_DELETED_CONFIRMATION",
        emailAddress: "user@example.com",
      }),
    });
  });

  test("does not enqueue email when hasUndeliverableEmailAddress is true", async () => {
    await maybeEnqueueDeletionEmail("user-id", "user@example.com", true);

    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(0);
    expect(mockIsUserIdBlocked).not.toHaveBeenCalled();
  });

  test("does not enqueue email when user is blocked", async () => {
    mockIsUserIdBlocked.mockResolvedValue(aisSuspended);

    await maybeEnqueueDeletionEmail("user-id", "user@example.com", false);

    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(0);
  });
});

describe("handler", () => {
  beforeEach(() => {
    dynamoMock.reset();
    sqsMock.reset();
    process.env.TABLE_NAME = "TABLE_NAME";
    process.env.NOTIFICATION_QUEUE_URL = "https://sqs.example.com/notification";
    process.env.AWS_REGION = "eu-west-2";
    mockIsUserIdBlocked.mockResolvedValue(aisNotSuspended);
    sqsMock.on(SendMessageCommand).resolves({});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("it iterates over each record in the batch", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [trackerItem] });

    await handler(TEST_SNS_EVENT_WITH_TWO_RECORDS, {} as Context);
    expect(dynamoMock.commandCalls(DeleteCommand).length).toEqual(2);
  });

  test("enqueues deletion email when account_deletion_reason is INACTIVE_ACCOUNT", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [trackerItem] });

    const event = createSnsEvent({ user_id: "user-id" });
    event.Records[0].Sns.MessageAttributes = {
      account_deletion_reason: { Type: "String", Value: "INACTIVE_ACCOUNT" },
    };

    await handler(event, {} as Context);

    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(1);
  });

  test("does not enqueue email when account_deletion_reason is absent", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [trackerItem] });

    await handler(TEST_SNS_EVENT_WITH_TWO_RECORDS, {} as Context);

    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(0);
  });

  test("does not enqueue email when account_deletion_reason is not INACTIVE_ACCOUNT", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [trackerItem] });

    const event = createSnsEvent({ user_id: "user-id" });
    event.Records[0].Sns.MessageAttributes = {
      account_deletion_reason: { Type: "String", Value: "OTHER_REASON" },
    };

    await handler(event, {} as Context);

    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(0);
  });

  test("does not enqueue email when no tracker records found", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [] });

    const event = createSnsEvent({ user_id: "user-id" });
    event.Records[0].Sns.MessageAttributes = {
      account_deletion_reason: { Type: "String", Value: "INACTIVE_ACCOUNT" },
    };

    await handler(event, {} as Context);

    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(0);
  });

  describe("error handling", () => {
    beforeEach(() => {
      dynamoMock.on(QueryCommand).rejects("mock error");
    });

    test("throws error with message ID", async () => {
      let errorMessage;
      try {
        await handler(TEST_SNS_EVENT_WITH_TWO_RECORDS, {} as Context);
      } catch (error) {
        errorMessage = (error as Error).message;
      }
      expect(errorMessage).toContain(
        "Unable to delete inactive account tracker data for message with ID: MessageId, mock error"
      );
    });
  });
});

describe("validateUserData", () => {
  test("doesn't throw an error with valid data", () => {
    expect(validateUserData(TEST_USER_DATA)).toBe(TEST_USER_DATA);
  });

  test("throws an error when user_id is missing", () => {
    const userData = JSON.parse(JSON.stringify({ foo: "bar" }));
    expect(() => {
      validateUserData(userData);
    }).toThrow();
  });
});
