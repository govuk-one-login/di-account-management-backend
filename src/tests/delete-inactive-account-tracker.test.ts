import { vi, describe, test, expect, beforeEach, afterEach } from "vitest";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { mockClient } from "aws-sdk-client-mock";
import "aws-sdk-client-mock-vitest";
import {
  handler,
  validateUserData,
  deleteUserData,
} from "../delete-inactive-account-tracker.js";

import {
  TEST_SNS_EVENT_WITH_TWO_RECORDS,
  TEST_USER_DATA,
} from "./testFixtures.js";
import { Context } from "aws-lambda";

const dynamoMock = mockClient(DynamoDBDocumentClient);
const sqsMock = mockClient(SQSClient);

const setAuditEnv = () => {
  process.env.TABLE_NAME = "TABLE_NAME";
  process.env.TXMA_QUEUE_URL =
    "https://sqs.eu-west-2.amazonaws.com/123456789012/TxmaQueue";
  process.env.FEATURE_SEND_IAD_AUDIT_EVENTS = "true";
  process.env.AWS_REGION = "eu-west-2";
};

describe("deleteUserData", () => {
  beforeEach(() => {
    dynamoMock.reset();
    sqsMock.reset();
    sqsMock.on(SendMessageCommand).resolves({ MessageId: "test-message-id" });
    setAuditEnv();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("queries the GSI and deletes matching records", async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [
        { dateForDeletion: "2030-01-01", commonSubjectId: "user-id" },
      ],
    });

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

    // A HOME_ACCOUNT_TRACKER_RECORD_DELETED audit event is emitted for the deleted record.
    const txmaCall = sqsMock
      .commandCalls(SendMessageCommand)
      .find(
        (call) =>
          call.args[0].input.QueueUrl ===
          "https://sqs.eu-west-2.amazonaws.com/123456789012/TxmaQueue"
      );
    expect(txmaCall).toBeDefined();
    const auditEvent = JSON.parse(txmaCall!.args[0].input.MessageBody as string);
    expect(auditEvent.event_name).toBe("HOME_ACCOUNT_TRACKER_RECORD_DELETED");
    expect(auditEvent.user).toMatchObject({ user_id: TEST_USER_DATA.user_id });
    expect(auditEvent.extensions).toMatchObject({
      accountTrackerAccountDeletionDate: "2030-01-01",
    });
  });

  test("does not emit an audit event when no records are found", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [] });

    await deleteUserData(TEST_USER_DATA);

    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(0);
  });

  test("emits an audit event for each deleted record", async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [
        { dateForDeletion: "2030-01-01", commonSubjectId: "user-id" },
        { dateForDeletion: "2031-01-01", commonSubjectId: "user-id" },
      ],
    });

    await deleteUserData(TEST_USER_DATA);

    const recordDeletedEvents = sqsMock
      .commandCalls(SendMessageCommand)
      .filter(
        (call) =>
          JSON.parse(call.args[0].input.MessageBody as string).event_name ===
          "HOME_ACCOUNT_TRACKER_RECORD_DELETED"
      );
    expect(recordDeletedEvents.length).toEqual(2);
  });

  test("does not delete when no records found", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [] });

    await deleteUserData(TEST_USER_DATA);

    expect(dynamoMock.commandCalls(DeleteCommand).length).toEqual(0);
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

describe("handler", () => {
  beforeEach(() => {
    dynamoMock.reset();
    sqsMock.reset();
    sqsMock.on(SendMessageCommand).resolves({ MessageId: "test-message-id" });
    setAuditEnv();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("it iterates over each record in the batch", async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [
        { dateForDeletion: "2030-01-01", commonSubjectId: "user-id" },
      ],
    });

    await handler(TEST_SNS_EVENT_WITH_TWO_RECORDS, {} as Context);
    expect(dynamoMock.commandCalls(DeleteCommand).length).toEqual(2);
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
