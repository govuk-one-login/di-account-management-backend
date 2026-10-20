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
  validateMessage,
  deleteTrackerItem,
  maybeEnqueueDeletionEmail,
} from "../delete-inactive-account-tracker.js";
import { DeletionMessage } from "../publish-account-deletion.js";

import {
  TEST_SNS_EVENT_WITH_TWO_RECORDS,
  createSnsEvent,
} from "./testFixtures.js";
import { Context } from "aws-lambda";

const TEST_DELETION_MESSAGE: DeletionMessage = { user_id: "user-id" };

const dynamoMock = mockClient(DynamoDBDocumentClient);
const sqsMock = mockClient(SQSClient);

const setAuditEnv = () => {
  process.env.TABLE_NAME = "TABLE_NAME";
  process.env.TXMA_QUEUE_URL =
    "https://sqs.eu-west-2.amazonaws.com/123456789012/TxmaQueue";
  process.env.NOTIFICATION_QUEUE_URL = "https://sqs.example.com/notification";
  process.env.AWS_REGION = "eu-west-2";
};

const mockIsUserIdBlocked = vi.hoisted(() => vi.fn());
vi.mock("../common/account-interventions-service-client.js", () => ({
  isUserIdBlocked: mockIsUserIdBlocked,
}));

const aisNotSuspended = false;
const aisSuspended = true;

const trackerItem = {
  dateForDeletion: "2030-01-01",
  commonSubjectId: "user-id",
  publicSubjectId: "public-user-id",
  status: "deleting",
  emailAddress: "user@example.com",
  hasUndeliverableEmailAddress: false,
  hasSetupMfa: true,
};

// The handler sends to two SQS queues: the TxMA audit queue (per deleted
// record) and the notification queue (deletion-confirmation email). These
// helpers count only the notification-email sends so the email-behaviour
// assertions are not affected by audit-event sends.
const NOTIFICATION_QUEUE_URL = "https://sqs.example.com/notification";
const notificationSendCount = () =>
  sqsMock
    .commandCalls(SendMessageCommand)
    .filter((call) => call.args[0].input.QueueUrl === NOTIFICATION_QUEUE_URL)
    .length;

describe("deleteTrackerItem", () => {
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
    dynamoMock.on(QueryCommand).resolves({ Items: [trackerItem] });

    await deleteTrackerItem(TEST_DELETION_MESSAGE, "INACTIVE_ACCOUNT");

    expect(dynamoMock).toHaveReceivedCommandWith(QueryCommand, {
      TableName: "TABLE_NAME",
      IndexName: "CommonSubjectIdIndex",
      KeyConditionExpression: "commonSubjectId = :uid",
      ExpressionAttributeValues: { ":uid": TEST_DELETION_MESSAGE.user_id },
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
    const auditEvent = JSON.parse(
      txmaCall!.args[0].input.MessageBody as string
    );
    expect(auditEvent.event_name).toBe("HOME_ACCOUNT_TRACKER_RECORD_DELETED");
    expect(auditEvent.user).toMatchObject({
      user_id: TEST_DELETION_MESSAGE.user_id,
      email: "user@example.com",
      public_subject_id: "public-user-id",
    });
    expect(auditEvent.extensions).toMatchObject({
      accountTrackerRecordStatus: "deleting",
      accountTrackerRecordDeletionReason: "INACTIVE_ACCOUNT",
    });
    expect(
      auditEvent.extensions.accountTrackerAccountDeletionDate
    ).toBeUndefined();
  });

  test("does not emit an audit event when no records are found", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [] });

    await deleteTrackerItem(TEST_DELETION_MESSAGE);

    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(0);
  });

  test("emits an audit event for each deleted record", async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [
        { dateForDeletion: "2030-01-01", commonSubjectId: "user-id" },
        { dateForDeletion: "2031-01-01", commonSubjectId: "user-id" },
      ],
    });

    await deleteTrackerItem(TEST_DELETION_MESSAGE);

    const recordDeletedEvents = sqsMock
      .commandCalls(SendMessageCommand)
      .filter(
        (call) =>
          JSON.parse(call.args[0].input.MessageBody as string).event_name ===
          "HOME_ACCOUNT_TRACKER_RECORD_DELETED"
      );
    expect(recordDeletedEvents.length).toEqual(2);
  });

  test("returns deleted: false when no records found", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [] });

    const result = await deleteTrackerItem(TEST_DELETION_MESSAGE);

    expect(result).toEqual({ deleted: false });
    expect(dynamoMock.commandCalls(DeleteCommand).length).toEqual(0);
  });

  test("returns deleted: true with emailAddress and hasUndeliverableEmailAddress from first item", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [trackerItem] });

    const result = await deleteTrackerItem(TEST_DELETION_MESSAGE);

    expect(result).toEqual({
      deleted: true,
      emailAddress: "user@example.com",
      hasUndeliverableEmailAddress: false,
      hasSetupMfa: true,
      dateForDeletion: "2030-01-01",
    });
  });

  test("deletes multiple records when query returns many", async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [
        { dateForDeletion: "2030-01-01", commonSubjectId: "user-id" },
        { dateForDeletion: "2031-01-01", commonSubjectId: "user-id" },
      ],
    });

    await deleteTrackerItem(TEST_DELETION_MESSAGE);

    expect(dynamoMock.commandCalls(DeleteCommand).length).toEqual(2);
  });
});

describe("maybeEnqueueDeletionEmail", () => {
  beforeEach(() => {
    sqsMock.reset();
    dynamoMock.reset();
    process.env.NOTIFICATION_QUEUE_URL = "https://sqs.example.com/notification";
    process.env.TXMA_QUEUE_URL =
      "https://sqs.eu-west-2.amazonaws.com/123456789012/TxmaQueue";
    process.env.AWS_REGION = "eu-west-2";
    mockIsUserIdBlocked.mockResolvedValue(aisNotSuspended);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("enqueues email when user is not blocked and email is deliverable", async () => {
    sqsMock.on(SendMessageCommand).resolves({});

    await maybeEnqueueDeletionEmail(
      "user-id",
      "user@example.com",
      false,
      true,
      "2026-10-20"
    );

    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl: "https://sqs.example.com/notification",
      MessageBody: JSON.stringify({
        notificationType: "INACTIVE_ACCOUNT_DELETED_CONFIRMATION",
        emailAddress: "user@example.com",
      }),
    });
  });

  test("does not enqueue email and emits PreviouslyUndeliverable skipped audit event when hasUndeliverableEmailAddress is true", async () => {
    sqsMock.on(SendMessageCommand).resolves({ MessageId: "test-message-id" });
    await maybeEnqueueDeletionEmail(
      "user-id",
      "user@example.com",
      true,
      true,
      "2026-10-20"
    );

    expect(notificationSendCount()).toEqual(0);
    expect(mockIsUserIdBlocked).not.toHaveBeenCalled();

    const txmaCall = sqsMock
      .commandCalls(SendMessageCommand)
      .find(
        (call) =>
          call.args[0].input.QueueUrl ===
          "https://sqs.eu-west-2.amazonaws.com/123456789012/TxmaQueue"
      );
    expect(txmaCall).toBeDefined();
    const auditEvent = JSON.parse(
      txmaCall!.args[0].input.MessageBody as string
    );
    expect(auditEvent.event_name).toBe(
      "HOME_ACCOUNT_TRACKER_NOTIFICATION_SKIPPED"
    );
    expect(auditEvent.user).toMatchObject({ user_id: "user-id" });
    expect(auditEvent.extensions).toMatchObject({
      accountTrackerNotificationSkipReason: "PreviouslyUndeliverable",
      accountTrackerNotificationType: "Deletion",
      accountTrackerAccountDeletionDate: "2026-10-20",
    });
  });

  test("does not enqueue email and emits MigratedVerifyAccount skipped audit event when date for deletion is 27th October 2026", async () => {
    sqsMock.on(SendMessageCommand).resolves({ MessageId: "test-message-id" });
    await maybeEnqueueDeletionEmail(
      "user-id",
      "user@example.com",
      false,
      true,
      "2026-10-27"
    );

    expect(notificationSendCount()).toEqual(0);

    const txmaCall = sqsMock
      .commandCalls(SendMessageCommand)
      .find(
        (call) =>
          call.args[0].input.QueueUrl ===
          "https://sqs.eu-west-2.amazonaws.com/123456789012/TxmaQueue"
      );
    expect(txmaCall).toBeDefined();
    const auditEvent = JSON.parse(
      txmaCall!.args[0].input.MessageBody as string
    );
    expect(auditEvent.event_name).toBe(
      "HOME_ACCOUNT_TRACKER_NOTIFICATION_SKIPPED"
    );
    expect(auditEvent.user).toMatchObject({ user_id: "user-id" });
    expect(auditEvent.extensions).toMatchObject({
      accountTrackerNotificationSkipReason: "MigratedVerifyAccount",
      accountTrackerNotificationType: "Deletion",
      accountTrackerAccountDeletionDate: "2026-10-27",
    });
  });

  test("does not enqueue email and emits IndefiniteSuspension skipped audit event when user is blocked", async () => {
    mockIsUserIdBlocked.mockResolvedValue(aisSuspended);
    sqsMock.on(SendMessageCommand).resolves({ MessageId: "test-message-id" });

    await maybeEnqueueDeletionEmail(
      "user-id",
      "user@example.com",
      false,
      true,
      "2026-10-20"
    );

    expect(notificationSendCount()).toEqual(0);

    const txmaCall = sqsMock
      .commandCalls(SendMessageCommand)
      .find(
        (call) =>
          call.args[0].input.QueueUrl ===
          "https://sqs.eu-west-2.amazonaws.com/123456789012/TxmaQueue"
      );
    expect(txmaCall).toBeDefined();
    const auditEvent = JSON.parse(
      txmaCall!.args[0].input.MessageBody as string
    );
    expect(auditEvent.event_name).toBe(
      "HOME_ACCOUNT_TRACKER_NOTIFICATION_SKIPPED"
    );
    expect(auditEvent.user).toMatchObject({ user_id: "user-id" });
    expect(auditEvent.extensions).toMatchObject({
      accountTrackerNotificationSkipReason: "IndefiniteSuspension",
      accountTrackerNotificationType: "Deletion",
      accountTrackerAccountDeletionDate: "2026-10-20",
    });
  });

  test("does not enqueue email and emits UnusableAccount skipped audit event when user has not set up MFA", async () => {
    sqsMock.on(SendMessageCommand).resolves({ MessageId: "test-message-id" });

    await maybeEnqueueDeletionEmail(
      "user-id",
      "user@example.com",
      false,
      false,
      "2026-10-20"
    );

    expect(notificationSendCount()).toEqual(0);
    expect(mockIsUserIdBlocked).not.toHaveBeenCalled();

    const txmaCall = sqsMock
      .commandCalls(SendMessageCommand)
      .find(
        (call) =>
          call.args[0].input.QueueUrl ===
          "https://sqs.eu-west-2.amazonaws.com/123456789012/TxmaQueue"
      );
    expect(txmaCall).toBeDefined();
    const auditEvent = JSON.parse(
      txmaCall!.args[0].input.MessageBody as string
    );
    expect(auditEvent.event_name).toBe(
      "HOME_ACCOUNT_TRACKER_NOTIFICATION_SKIPPED"
    );
    expect(auditEvent.user).toMatchObject({ user_id: "user-id" });
    expect(auditEvent.extensions).toMatchObject({
      accountTrackerNotificationSkipReason: "UnusableAccount",
      accountTrackerNotificationType: "Deletion",
      accountTrackerAccountDeletionDate: "2026-10-20",
    });
  });
});

describe("handler", () => {
  beforeEach(() => {
    dynamoMock.reset();
    sqsMock.reset();
    setAuditEnv();
    mockIsUserIdBlocked.mockResolvedValue(aisNotSuspended);
    sqsMock.on(SendMessageCommand).resolves({ MessageId: "test-message-id" });
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

    await handler(
      createSnsEvent({
        user_id: "user-id",
        account_deletion_reason: "INACTIVE_ACCOUNT",
      }),
      {} as Context
    );

    expect(notificationSendCount()).toEqual(1);
  });

  test("logs InactiveAccountDeleted when account_deletion_reason is INACTIVE_ACCOUNT", async () => {
    const { Logger } = await import("@aws-lambda-powertools/logger");
    const infoSpy = vi.spyOn(Logger.prototype, "info");

    dynamoMock.on(QueryCommand).resolves({ Items: [trackerItem] });

    await handler(
      createSnsEvent({
        user_id: "user-id",
        account_deletion_reason: "INACTIVE_ACCOUNT",
      }),
      {} as Context
    );

    expect(infoSpy).toHaveBeenCalledWith("InactiveAccountDeleted", {
      hasUndeliverableEmailAddress: trackerItem.hasUndeliverableEmailAddress,
      hasSetupMfa: trackerItem.hasSetupMfa,
      dateForDeletion: trackerItem.dateForDeletion,
    });

    infoSpy.mockRestore();
  });

  test("does not log InactiveAccountDeleted when account_deletion_reason is not INACTIVE_ACCOUNT", async () => {
    const { Logger } = await import("@aws-lambda-powertools/logger");
    const infoSpy = vi.spyOn(Logger.prototype, "info");

    dynamoMock.on(QueryCommand).resolves({ Items: [trackerItem] });

    await handler(
      createSnsEvent({
        user_id: "user-id",
        account_deletion_reason: "OTHER_REASON",
      }),
      {} as Context
    );

    expect(infoSpy).not.toHaveBeenCalledWith(
      "InactiveAccountDeleted",
      expect.anything()
    );

    infoSpy.mockRestore();
  });

  test("does not enqueue email when account_deletion_reason is absent", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [trackerItem] });

    await handler(TEST_SNS_EVENT_WITH_TWO_RECORDS, {} as Context);

    expect(notificationSendCount()).toEqual(0);
  });

  test("does not enqueue email when account_deletion_reason is not INACTIVE_ACCOUNT", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [trackerItem] });

    await handler(
      createSnsEvent({
        user_id: "user-id",
        account_deletion_reason: "OTHER_REASON",
      }),
      {} as Context
    );

    expect(notificationSendCount()).toEqual(0);
  });

  test("deletes record but does not enqueue email when date for deletion is 27th October 2026", async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [
        {
          dateForDeletion: "2026-10-27",
          commonSubjectId: "user-id",
          emailAddress: "user@example.com",
          hasUndeliverableEmailAddress: false,
          hasSetupMfa: true,
        },
      ],
    });
    await handler(createSnsEvent({ user_id: "user-id" }), {} as Context);

    expect(dynamoMock.commandCalls(DeleteCommand).length).toEqual(1);
    expect(notificationSendCount()).toEqual(0);
  });

  test("does not enqueue email when no tracker records found", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [] });

    await handler(
      createSnsEvent({
        user_id: "user-id",
        account_deletion_reason: "INACTIVE_ACCOUNT",
      }),
      {} as Context
    );

    expect(notificationSendCount()).toEqual(0);
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

describe("validateMessage", () => {
  test("doesn't throw an error with valid data", () => {
    expect(validateMessage(TEST_DELETION_MESSAGE)).toBe(TEST_DELETION_MESSAGE);
  });

  test("throws an error when user_id is missing", () => {
    const userData = JSON.parse(JSON.stringify({ foo: "bar" }));
    expect(() => {
      validateMessage(userData);
    }).toThrow();
  });
});
