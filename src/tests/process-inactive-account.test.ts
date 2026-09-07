import { vi, describe, test, expect, beforeEach } from "vitest";
import { Context, SQSEvent } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { DynamoDBDocumentClient, UpdateCommand, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import "aws-sdk-client-mock-vitest";

const mockMetrics = vi.hoisted(() => ({
  publishStoredMetrics: vi.fn(),
  addDimension: vi.fn(),
  addMetric: vi.fn(),
}));
const mockInitMetrics = vi.hoisted(() => vi.fn(() => mockMetrics));

const mockHasAisBlockIntervention = vi.hoisted(() => vi.fn());
const mockHasRecentActivityLogEntry = vi.hoisted(() => vi.fn());
const mockSendInactiveAccountEmailsIsEnabled = vi.hoisted(() => vi.fn());
const mockHasEmailAddress = vi.hoisted(() => vi.fn());

vi.mock("../common/metrics.js", () => ({
  initMetrics: mockInitMetrics,
}));

vi.mock("../common/iadGuards/hasAisBlockIntervention.js", () => ({
  hasAisBlockIntervention: mockHasAisBlockIntervention,
}));

vi.mock("../common/iadGuards/hasRecentActivityLogEntry.js", () => ({
  hasRecentActivityLogEntry: mockHasRecentActivityLogEntry,
}));

vi.mock("../common/iadGuards/sendInactiveAccountEmailsIsEnabled.js", () => ({
  sendInactiveAccountEmailsIsEnabled: mockSendInactiveAccountEmailsIsEnabled,
}));

vi.mock("../common/iadGuards/hasEmailAddress.js", () => ({
  hasEmailAddress: mockHasEmailAddress,
}));

import { handler } from "../process-inactive-account.js";

const sqsMock = mockClient(SQSClient);
const dynamoMock = mockClient(DynamoDBDocumentClient);

const buildSqsEvent = (bodies: object[]): SQSEvent => ({
  Records: bodies.map((body, index) => ({
    messageId: `msg-${index}`,
    receiptHandle: `handle-${index}`,
    body: JSON.stringify(body),
    attributes: {
      ApproximateReceiveCount: "1",
      SentTimestamp: "1234567890",
      SenderId: "sender",
      ApproximateFirstReceiveTimestamp: "1234567890",
    },
    messageAttributes: {},
    md5OfBody: "md5",
    eventSource: "aws:sqs",
    eventSourceARN: "arn:aws:sqs:eu-west-2:123456789012:30DayNotificationQueue",
    awsRegion: "eu-west-2",
  })),
});

const notBlocked = { continue: "Continue", guardName: "AIS" };
const blocked = { continue: "Abort", guardName: "AIS" };
const noRecentActivity = { continue: "Continue", guardName: "HomeUserActivityLog" };
const recentActivity = { continue: "Abort", guardName: "HomeUserActivityLog" };
const inactiveAccountEmailsFeatureFlagDisabled = { continue: "Abort", guardName: "SendInactiveAccountEmailsFeatureFlag" };
const inactiveAccountEmailsFeatureFlagEnabled = { continue: "Continue", guardName: "SendInactiveAccountEmailsFeatureFlag" };
const hasEmailAddressContinue = { continue: "Continue", guardName: "SendInactiveAccountEmailsFeatureFlag" };
const hasEmailAddressAbort = { continue: "Abort", guardName: "SendInactiveAccountEmailsFeatureFlag" };

describe("process-inactive-account handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sqsMock.reset();
    dynamoMock.reset();
    sqsMock.on(SendMessageCommand).resolves({ MessageId: "test-message-id" });
    dynamoMock.on(QueryCommand).resolves({ Items: [] });
    dynamoMock.on(UpdateCommand).resolves({});
    dynamoMock.on(TransactWriteCommand).resolves({});

    mockHasAisBlockIntervention.mockResolvedValue(notBlocked);
    mockHasRecentActivityLogEntry.mockResolvedValue(noRecentActivity);
    mockSendInactiveAccountEmailsIsEnabled.mockResolvedValue(inactiveAccountEmailsFeatureFlagEnabled);
    mockHasEmailAddress.mockResolvedValue(hasEmailAddressContinue);

    process.env.NOTIFICATION_QUEUE_URL =
      "https://sqs.eu-west-2.amazonaws.com/123456789012/NotificationQueue";
    process.env.INACTIVE_ACCOUNT_TRACKER_TABLE_NAME =
      "test-inactive-tracker-table";
    process.env.SEND_INACTIVE_ACCOUNT_DELETION_EMAILS = '1';
    process.env.FEATURE_SEND_IAD_AUDIT_EVENTS = "false";
    process.env.TXMA_QUEUE_URL = "https://sqs.eu-west-2.amazonaws.com/123456789012/TxmaQueue";
    process.env.AWS_REGION = "eu-west-2";
  });

  test("enqueues a 30-day warning notification to the NotificationQueue", async () => {
    const event = buildSqsEvent([
      {
        commonSubjectId: "user-123",
        emailAddress: "test@example.com",
        dateForDeletion: "2026-08-15",
        processName: "Warning30Day",
        status: "pending",
      },
    ]);

    await handler(event, {} as Context);

    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl:
        "https://sqs.eu-west-2.amazonaws.com/123456789012/NotificationQueue",
      MessageBody: JSON.stringify({
        notificationType: "INACTIVE_ACCOUNT_WARNING_30_DAY",
        emailAddress: "test@example.com",
        dateForDeletion: "2026-08-15",
      }),
    });
    expect(dynamoMock).toHaveReceivedCommandWith(UpdateCommand, {
      TableName: "test-inactive-tracker-table",
      Key: {
        dateForDeletion: "2026-08-15",
        commonSubjectId: "user-123",
      },
      UpdateExpression: "SET #status = :status, statusLastUpdated = :timestamp",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":status": "30DayWarningSent",
        ":timestamp": expect.any(String),
      },
    });
    expect(mockMetrics.addMetric).toHaveBeenCalledWith(
      "notificationEnqueued",
      expect.anything(),
      1
    );
    expect(mockMetrics.publishStoredMetrics).toHaveBeenCalledTimes(1);
  });

  test("enqueues a 7-day warning notification to the NotificationQueue", async () => {
    const event = buildSqsEvent([
      {
        commonSubjectId: "user-456",
        emailAddress: "user@example.com",
        dateForDeletion: "2026-07-27",
        processName: "Warning7Day",
        status: "30DayWarningSent",
      },
    ]);

    await handler(event, {} as Context);

    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl:
        "https://sqs.eu-west-2.amazonaws.com/123456789012/NotificationQueue",
      MessageBody: JSON.stringify({
        notificationType: "INACTIVE_ACCOUNT_WARNING_7_DAY",
        emailAddress: "user@example.com",
        dateForDeletion: "2026-07-27",
      }),
    });
    expect(dynamoMock).toHaveReceivedCommandWith(UpdateCommand, {
      TableName: "test-inactive-tracker-table",
      Key: {
        dateForDeletion: "2026-07-27",
        commonSubjectId: "user-456",
      },
      UpdateExpression: "SET #status = :status, statusLastUpdated = :timestamp",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":status": "7DayWarningSent",
        ":timestamp": expect.any(String),
      },
    });
    expect(mockMetrics.addMetric).toHaveBeenCalledWith(
      "notificationEnqueued",
      expect.anything(),
      1
    );
  });

  test("skips record when status is not allowed for process", async () => {
    const event = buildSqsEvent([
      {
        commonSubjectId: "user-789",
        emailAddress: "test@example.com",
        dateForDeletion: "2026-08-15",
        processName: "Warning30Day",
        status: "30DayWarningSent",
      },
    ]);

    await handler(event, {} as Context);

    expect(sqsMock).not.toHaveReceivedCommand(SendMessageCommand);
    expect(dynamoMock).not.toHaveReceivedCommand(UpdateCommand);
  });

  test("skips processing when AIS guard blocks the user", async () => {
    mockHasAisBlockIntervention.mockResolvedValue(blocked);

    const event = buildSqsEvent([
      {
        commonSubjectId: "blocked-user-123",
        emailAddress: "blocked@example.com",
        dateForDeletion: "2026-08-15",
        processName: "Warning30Day",
        status: "pending",
        statusLastUpdated: "2024-01-01T00:00:00.000Z",
        userLastActive: "2024-01-01T00:00:00.000Z",
        userLastActiveSource: "auth",
        userLastActiveUpdated: "2024-01-01T00:00:00.000Z",
        emailAddressLastUpdated: "2024-01-01T00:00:00.000Z",
        emailAddressSource: "auth",
        hasSetupMfa: true,
      },
    ]);

    await handler(event, {} as Context);

    expect(mockHasAisBlockIntervention).toHaveBeenCalledWith(
      "blocked-user-123",
      "blocked@example.com"
    );
    expect(sqsMock).not.toHaveReceivedCommand(SendMessageCommand);
    expect(dynamoMock).not.toHaveReceivedCommand(UpdateCommand);
    expect(mockMetrics.addMetric).not.toHaveBeenCalled();
  });

  test("skips blocked user but processes non-blocked user in same batch", async () => {
    mockHasAisBlockIntervention
      .mockResolvedValueOnce(blocked)
      .mockResolvedValueOnce(notBlocked);

    const event = buildSqsEvent([
      {
        commonSubjectId: "blocked-user",
        emailAddress: "blocked@example.com",
        dateForDeletion: "2026-08-15",
        processName: "Warning30Day",
        status: "pending",
      },
      {
        commonSubjectId: "active-user",
        emailAddress: "active@example.com",
        dateForDeletion: "2026-08-20",
        processName: "Warning30Day",
        status: "pending",
      },
    ]);

    await handler(event, {} as Context);

    expect(mockHasAisBlockIntervention).toHaveBeenCalledTimes(2);
    expect(sqsMock).toHaveReceivedCommandTimes(SendMessageCommand, 1);
    expect(dynamoMock).toHaveReceivedCommandTimes(UpdateCommand, 1);
    expect(dynamoMock).toHaveReceivedCommandWith(UpdateCommand, {
      TableName: "test-inactive-tracker-table",
      Key: {
        dateForDeletion: "2026-08-20",
        commonSubjectId: "active-user",
      },
      UpdateExpression: "SET #status = :status, statusLastUpdated = :timestamp",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":status": "30DayWarningSent",
        ":timestamp": expect.any(String),
      },
    });
  });

  test("processes multiple records from a batch", async () => {
    const event = buildSqsEvent([
      {
        commonSubjectId: "user-1",
        emailAddress: "user1@example.com",
        dateForDeletion: "2026-08-15",
        processName: "Warning30Day",
        status: "pending",
      },
      {
        commonSubjectId: "user-2",
        emailAddress: "user2@example.com",
        dateForDeletion: "2026-07-27",
        processName: "Warning7Day",
        status: "pending",
      },
    ]);

    await handler(event, {} as Context);

    expect(sqsMock).toHaveReceivedCommandTimes(SendMessageCommand, 2);
    expect(dynamoMock).toHaveReceivedCommandTimes(UpdateCommand, 2);
    expect(mockMetrics.publishStoredMetrics).toHaveBeenCalledTimes(1);
  });

  test("throws error when SQS send fails", async () => {
    sqsMock.on(SendMessageCommand).rejects(new Error("SQS send failed"));

    const event = buildSqsEvent([
      {
        commonSubjectId: "user-123",
        emailAddress: "test@example.com",
        dateForDeletion: "2026-08-15",
        processName: "Warning30Day",
        status: "pending",
      },
    ]);

    await expect(handler(event, {} as Context)).rejects.toThrow(
      "SQS send failed"
    );
  });

  test("throws when process configuration is not found", async () => {
    const event = buildSqsEvent([
      {
        commonSubjectId: "user-123",
        emailAddress: "test@example.com",
        dateForDeletion: "2026-08-15",
        processName: "UnknownProcess",
        status: "pending",
      },
    ]);

    await expect(handler(event, {} as Context)).rejects.toThrow(
      "Process configuration not found for UnknownProcess"
    );
  });

  test("throws when DynamoDB update fails", async () => {
    dynamoMock.on(UpdateCommand).rejects(new Error("DynamoDB update failed"));

    const event = buildSqsEvent([
      {
        commonSubjectId: "user-123",
        emailAddress: "test@example.com",
        dateForDeletion: "2026-08-15",
        processName: "Warning30Day",
        status: "pending",
      },
    ]);

    await expect(handler(event, {} as Context)).rejects.toThrow(
      "DynamoDB update failed"
    );
  });

  test("skips notification but still updates status and sends to target queue when notificationType is not configured", async () => {
    process.env.ACCOUNT_DELETION_QUEUE_URL =
      "https://sqs.eu-west-2.amazonaws.com/123456789012/AccountDeletionQueue";

    const event = buildSqsEvent([
      {
        commonSubjectId: "user-123",
        publicSubjectId: "public-123",
        emailAddress: "test@example.com",
        dateForDeletion: "2026-08-15",
        processName: "DeleteAccount",
        status: "pending",
      },
    ]);

    await handler(event, {} as Context);

    expect(sqsMock).toHaveReceivedCommandTimes(SendMessageCommand, 1);
    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl:
        "https://sqs.eu-west-2.amazonaws.com/123456789012/AccountDeletionQueue",
      MessageBody: JSON.stringify({
        publicSubjectId: "public-123",
        commonSubjectId: "user-123",
      }),
    });
    expect(dynamoMock).toHaveReceivedCommandWith(UpdateCommand, {
      TableName: "test-inactive-tracker-table",
      Key: {
        dateForDeletion: "2026-08-15",
        commonSubjectId: "user-123",
      },
      UpdateExpression: "SET #status = :status, statusLastUpdated = :timestamp",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":status": "deleting",
        ":timestamp": expect.any(String),
      },
    });
    expect(mockMetrics.addMetric).not.toHaveBeenCalledWith(
      "notificationEnqueued",
      expect.anything(),
      1
    );
    expect(mockMetrics.publishStoredMetrics).toHaveBeenCalledTimes(1);
  });

  test("does not send to target queue when targetQueueUrlEnvVar is not configured", async () => {
    const event = buildSqsEvent([
      {
        commonSubjectId: "user-123",
        publicSubjectId: "public-123",
        emailAddress: "test@example.com",
        dateForDeletion: "2026-08-15",
        processName: "Warning30Day",
        status: "pending",
      },
    ]);

    await handler(event, {} as Context);

    expect(sqsMock).toHaveReceivedCommandTimes(SendMessageCommand, 1);
    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl:
        "https://sqs.eu-west-2.amazonaws.com/123456789012/NotificationQueue",
      MessageBody: JSON.stringify({
        notificationType: "INACTIVE_ACCOUNT_WARNING_30_DAY",
        emailAddress: "test@example.com",
        dateForDeletion: "2026-08-15",
      }),
    });
  });

  test("skips deletion when hasRecentActivityLogEntry guard blocks the user", async () => {
    mockHasRecentActivityLogEntry.mockResolvedValue(recentActivity);
    process.env.ACCOUNT_DELETION_QUEUE_URL =
      "https://sqs.eu-west-2.amazonaws.com/123456789012/AccountDeletionQueue";

    const event = buildSqsEvent([
      {
        commonSubjectId: "user-123",
        publicSubjectId: "public-123",
        emailAddress: "test@example.com",
        dateForDeletion: "2026-08-15",
        processName: "DeleteAccount",
        status: "pending",
      },
    ]);

    await handler(event, {} as Context);

    expect(sqsMock).not.toHaveReceivedCommand(SendMessageCommand);
    expect(dynamoMock).not.toHaveReceivedCommand(UpdateCommand);
    expect(mockMetrics.addMetric).not.toHaveBeenCalled();
  });

  test("hasRecentActivityLogEntry guard is not called for Warning30Day process", async () => {
    const event = buildSqsEvent([
      {
        commonSubjectId: "user-123",
        emailAddress: "test@example.com",
        dateForDeletion: "2026-08-15",
        processName: "Warning30Day",
        status: "pending",
      },
    ]);

    await handler(event, {} as Context);

    expect(mockHasRecentActivityLogEntry).not.toHaveBeenCalled();
  });

  test("skips when record has hasUndeliverableEmailAddress", async () => {
    dynamoMock.on(QueryCommand, {
      TableName: "test-inactive-tracker-table",
      IndexName: "CommonSubjectIdIndex",
    }).resolves({
      Items: [
        {
          commonSubjectId: "undeliverablee",
          emailAddress: "i-am-not-deliverable@undlvrbl.com",
          dateForDeletion: "2026-08-30",
          hasUndeliverableEmailAddress: true,
        },
      ],
    });

    const event = buildSqsEvent([
      {
        commonSubjectId: "undeliverablee",
        emailAddress: "i-am-not-deliverable@undlvrbl.com",
        dateForDeletion: "2026-08-30",
        processName: "Warning30Day",
        status: "pending",
      },
    ]);

    await handler(event, {} as Context);

    expect(dynamoMock).toHaveReceivedCommandWith(QueryCommand, {
      TableName: "test-inactive-tracker-table",
      IndexName: "CommonSubjectIdIndex",
      KeyConditionExpression: "commonSubjectId = :id",
      ExpressionAttributeValues: {
        ":id": "undeliverablee",
      },
    });

    // for undeliverable email addresses, do not enqueue notification
    expect(sqsMock).not.toHaveReceivedCommand(SendMessageCommand);
    expect(mockMetrics.addMetric).not.toHaveBeenCalledWith("notificationEnqueued", expect.anything());
    // status should still be updated in the inactive account tracker
    expect(dynamoMock).toHaveReceivedCommand(UpdateCommand);
  });

  test("continue as expected where there is no hasUndeliverableEmailAddress flag", async () => {
    dynamoMock.on(QueryCommand, {
      TableName: "test-inactive-tracker-table",
      IndexName: "EmailAddressIndex",
    }).resolves({
      Items: [
        {
          commonSubjectId: "deliverable",
          emailAddress: "deliverable@asdf.com",
          dateForDeletion: "2026-08-12",
        },
      ],
    });

    const event = buildSqsEvent([
      {
        commonSubjectId: "deliverable",
        emailAddress: "deliverable@asdf.com",
        dateForDeletion: "2026-08-15",
        processName: "Warning30Day",
        status: "pending",
      },
    ]);

    await handler(event, {} as Context);
    expect(sqsMock).toHaveReceivedCommand(SendMessageCommand);
    expect(dynamoMock).toHaveReceivedCommand(QueryCommand);
    expect(dynamoMock).toHaveReceivedCommand(UpdateCommand);
    expect(mockMetrics.addMetric).toHaveBeenCalledWith("notificationEnqueued", expect.anything(), 1);
  });

  test("skips processing when hasEmailAddress guard returns Abort", async () => {
    mockHasEmailAddress.mockResolvedValue(hasEmailAddressAbort);

    const event = buildSqsEvent([
      {
        commonSubjectId: "user-no-email",
        emailAddress: "",
        dateForDeletion: "2026-08-15",
        processName: "Warning30Day",
        status: "pending",
      },
    ]);

    await handler(event, {} as Context);

    expect(mockHasEmailAddress).toHaveBeenCalledWith("user-no-email", "");
    expect(sqsMock).not.toHaveReceivedCommand(SendMessageCommand);
    expect(dynamoMock).not.toHaveReceivedCommand(UpdateCommand);
  });

  test("skips processing when inactive account deletion feature flag guard returns Abort", async () => {
    mockSendInactiveAccountEmailsIsEnabled.mockResolvedValue(inactiveAccountEmailsFeatureFlagDisabled);

    const event = buildSqsEvent([
      {
        commonSubjectId: "user-456",
        emailAddress: "user@example.com",
        dateForDeletion: "2026-07-27",
        processName: "Warning7Day",
        status: "30DayWarningSent",
      },
    ]);

    await handler(event, {} as Context);

    expect(mockSendInactiveAccountEmailsIsEnabled).toHaveBeenCalled();
    expect(sqsMock).not.toHaveReceivedCommand(SendMessageCommand);
    expect(dynamoMock).not.toHaveReceivedCommand(UpdateCommand);
    expect(mockMetrics.addMetric).not.toHaveBeenCalled();
  });

  describe("merge before processing", () => {
    test("merges duplicate rows, deletes stale rows, and processes using the merged record", async () => {
      // Two rows for the same user (race condition). The newer activity row (2026-06-01)
      // owns dateForDeletion; the stale row (2031-01-01) must be deleted. The newer row
      // also carries the 30DayWarningSent status so the Warning7Day process (which allows it)
      // should proceed and update the surviving row keyed on the merged dateForDeletion.
      dynamoMock
        .on(QueryCommand, {
          TableName: "test-inactive-tracker-table",
          IndexName: "CommonSubjectIdIndex",
        })
        .resolves({
          Items: [
            {
              commonSubjectId: "dup-user",
              publicSubjectId: "public-old",
              dateForDeletion: "2031-01-01",
              status: "pending",
              statusLastUpdated: "2026-01-01T00:00:00.000Z",
              userLastActive: "2021-01-01T00:00:00.000Z",
              userLastActiveSource: "OLD",
              userLastActiveUpdated: "2026-01-01T00:00:00.000Z",
              emailAddress: "dup@example.com",
              emailAddressLastUpdated: "2026-01-01T00:00:00.000Z",
              hasSetupMfa: false,
            },
            {
              commonSubjectId: "dup-user",
              publicSubjectId: "public-new",
              dateForDeletion: "2031-06-01",
              status: "30DayWarningSent",
              statusLastUpdated: "2026-06-01T00:00:00.000Z",
              userLastActive: "2026-06-01T00:00:00.000Z",
              userLastActiveSource: "NEW",
              userLastActiveUpdated: "2026-06-01T00:00:00.000Z",
              emailAddress: "dup@example.com",
              emailAddressLastUpdated: "2026-06-01T00:00:00.000Z",
              hasSetupMfa: false,
            },
          ],
        });

      const event = buildSqsEvent([
        {
          commonSubjectId: "dup-user",
          emailAddress: "dup@example.com",
          dateForDeletion: "2031-01-01",
          processName: "Warning7Day",
          status: "pending",
        },
      ]);

      await handler(event, {} as Context);

      // The merged record is written and the stale duplicate row (2031-01-01) is deleted;
      // the surviving row (2031-06-01) is written by the Put and must NOT be deleted.
      expect(dynamoMock).toHaveReceivedCommandWith(TransactWriteCommand, {
        TransactItems: expect.arrayContaining([
          expect.objectContaining({
            Put: expect.objectContaining({
              TableName: "test-inactive-tracker-table",
              Item: expect.objectContaining({
                commonSubjectId: "dup-user",
                dateForDeletion: "2031-06-01",
                status: "30DayWarningSent",
              }),
            }),
          }),
          expect.objectContaining({
            Delete: expect.objectContaining({
              TableName: "test-inactive-tracker-table",
              Key: { dateForDeletion: "2031-01-01", commonSubjectId: "dup-user" },
            }),
          }),
        ]),
      });
      expect(dynamoMock).toHaveReceivedCommandWith(TransactWriteCommand, {
        TransactItems: expect.not.arrayContaining([
          expect.objectContaining({
            Delete: expect.objectContaining({
              Key: { dateForDeletion: "2031-06-01", commonSubjectId: "dup-user" },
            }),
          }),
        ]),
      });

      // Status update targets the surviving merged row (merged dateForDeletion), not the
      // stale dateForDeletion that arrived on the message body.
      expect(dynamoMock).toHaveReceivedCommandWith(UpdateCommand, {
        TableName: "test-inactive-tracker-table",
        Key: {
          dateForDeletion: "2031-06-01",
          commonSubjectId: "dup-user",
        },
        UpdateExpression: "SET #status = :status, statusLastUpdated = :timestamp",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":status": "7DayWarningSent",
          ":timestamp": expect.any(String),
        },
      });
    });

    test("does not run a merge transaction when the user has a single tracker row", async () => {
      dynamoMock
        .on(QueryCommand, {
          TableName: "test-inactive-tracker-table",
          IndexName: "CommonSubjectIdIndex",
        })
        .resolves({
          Items: [
            {
              commonSubjectId: "single-user",
              dateForDeletion: "2026-08-15",
              status: "pending",
              emailAddress: "single@example.com",
            },
          ],
        });

      const event = buildSqsEvent([
        {
          commonSubjectId: "single-user",
          emailAddress: "single@example.com",
          dateForDeletion: "2026-08-15",
          processName: "Warning30Day",
          status: "pending",
        },
      ]);

      await handler(event, {} as Context);

      expect(dynamoMock).not.toHaveReceivedCommand(TransactWriteCommand);
      // Normal processing still occurs on the body as dispatched.
      expect(dynamoMock).toHaveReceivedCommandWith(UpdateCommand, {
        TableName: "test-inactive-tracker-table",
        Key: { dateForDeletion: "2026-08-15", commonSubjectId: "single-user" },
        UpdateExpression: "SET #status = :status, statusLastUpdated = :timestamp",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":status": "30DayWarningSent",
          ":timestamp": expect.any(String),
        },
      });
    });

    test("does not run a merge transaction when the user has no tracker rows", async () => {
      // Default QueryCommand mock resolves { Items: [] }.
      const event = buildSqsEvent([
        {
          commonSubjectId: "no-rows-user",
          emailAddress: "norows@example.com",
          dateForDeletion: "2026-08-15",
          processName: "Warning30Day",
          status: "pending",
        },
      ]);

      await handler(event, {} as Context);

      expect(dynamoMock).not.toHaveReceivedCommand(TransactWriteCommand);
    });
  });
});
