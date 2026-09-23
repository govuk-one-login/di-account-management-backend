import { vi, describe, test, expect, beforeEach } from "vitest";
import { Logger } from "@aws-lambda-powertools/logger";
import { Context, SQSEvent } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import {
  DynamoDBDocumentClient,
  UpdateCommand,
  QueryCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
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
const mockSendInactiveAccountEmailsIsDisabled = vi.hoisted(() => vi.fn());
const mockDoesNotHaveEmailAddress = vi.hoisted(() => vi.fn());

vi.mock("../common/metrics.js", () => ({
  initMetrics: mockInitMetrics,
}));

vi.mock("../common/iadGuards/hasAisBlockIntervention.js", () => ({
  hasAisBlockIntervention: mockHasAisBlockIntervention,
}));

vi.mock("../common/iadGuards/hasRecentActivityLogEntry.js", () => ({
  hasRecentActivityLogEntry: mockHasRecentActivityLogEntry,
}));

vi.mock("../common/iadGuards/sendInactiveAccountEmailsIsDisabled.js", () => ({
  sendInactiveAccountEmailsIsDisabled: mockSendInactiveAccountEmailsIsDisabled,
}));

vi.mock("../common/iadGuards/doesNotHaveEmailAddress.js", () => ({
  doesNotHaveEmailAddress: mockDoesNotHaveEmailAddress,
}));

const mockGetIadCircuitBreakerStatus = vi.hoisted(() =>
  vi.fn().mockResolvedValue(false)
);

const mockGetSecret = vi.hoisted(() =>
  vi.fn().mockResolvedValue("test-pepper")
);

vi.mock("@aws-lambda-powertools/parameters/secrets", () => ({
  getSecret: mockGetSecret,
}));

let mockHashDigestValue =
  "2dffe9978d141956695fafad3fc82b15dbcce3d79add18754991a0a714b67556"; // pragma: allowlist secret

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return {
    ...actual,
    createHash: () => ({
      update: () => ({
        digest: () => mockHashDigestValue,
      }),
    }),
  };
});

vi.mock("../common/iad-circuit-breaker.js", () => ({
  getIadCircuitBreakerStatus: mockGetIadCircuitBreakerStatus,
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

const notBlocked = { guardActivated: false, guardName: "AIS" };
const blocked = { guardActivated: true, guardName: "AIS" };
const noRecentActivity = {
  guardActivated: false,
  guardName: "HomeActivityLogContradiction",
};
const recentActivity = {
  guardActivated: true,
  guardName: "HomeActivityLogContradiction",
};
const inactiveAccountEmailsFeatureFlagDisabled = {
  guardActivated: true,
  guardName: "SendInactiveAccountEmailsFeatureFlag",
};
const inactiveAccountEmailsFeatureFlagEnabled = {
  guardActivated: false,
  guardName: "SendInactiveAccountEmailsFeatureFlag",
};
const doesNotHaveEmailAddressContinue = {
  guardActivated: false,
  guardName: "DoesNotHaveEmailAddress",
};
const doesNotHaveEmailAddressAbort = {
  guardActivated: true,
  guardName: "DoesNotHaveEmailAddress",
};

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
    mockSendInactiveAccountEmailsIsDisabled.mockResolvedValue(
      inactiveAccountEmailsFeatureFlagEnabled
    );
    mockDoesNotHaveEmailAddress.mockResolvedValue(
      doesNotHaveEmailAddressContinue
    );
    mockGetIadCircuitBreakerStatus.mockResolvedValue(false);

    process.env.NOTIFICATION_QUEUE_URL =
      "https://sqs.eu-west-2.amazonaws.com/123456789012/NotificationQueue";
    process.env.INACTIVE_ACCOUNT_TRACKER_TABLE_NAME =
      "test-inactive-tracker-table";
    process.env.SEND_INACTIVE_ACCOUNT_DELETION_EMAILS = "1";
    process.env.FEATURE_SEND_IAD_AUDIT_EVENTS = "false";
    process.env.TXMA_QUEUE_URL =
      "https://sqs.eu-west-2.amazonaws.com/123456789012/TxmaQueue";
    process.env.AWS_REGION = "eu-west-2";
    process.env.FEATURE_SEND_IAD_AUDIT_EVENTS = "true";
    process.env.ENVIRONMENT = "production";
    process.env.IAD_TESTING_PEPPER_SECRET_ARN =
      "arn:aws:secretsmanager:eu-west-2:123456789012:secret:IADTestingPepper";
  });

  test("aborts early and logs when circuit breaker is active", async () => {
    mockGetIadCircuitBreakerStatus.mockResolvedValue(true);

    const infoSpy = vi.spyOn(Logger.prototype, "info");

    const body = {
      commonSubjectId: "user-123",
      emailAddress: "test@example.com",
      dateForDeletion: "2026-08-15",
      processName: "Warning30Day",
      status: "pending",
      statusLastUpdated: "2026-01-01T00:00:00.000Z",
      userLastActive: "2021-06-20T00:00:00.000Z",
      userLastActiveSource: "AUTH_AUTH_CODE_ISSUED",
      userLastActiveSourceId: "event-guid",
      userLastActiveUpdated: "2026-01-01T00:00:00.000Z",
      emailAddressLastUpdated: "2026-01-01T00:00:00.000Z",
      emailAddressSource: "AUTH_AUTH_CODE_ISSUED",
      emailAddressSourceId: "email-event-guid",
      hasSetupMfa: "false",
    };

    await handler(buildSqsEvent([body]), {} as Context);

    expect(sqsMock).not.toHaveReceivedCommand(SendMessageCommand);
    expect(dynamoMock).not.toHaveReceivedCommand(UpdateCommand);
    expect(infoSpy).toHaveBeenCalledWith(
      "GuardrailAbortedProcessInactiveAccounts",
      {
        dateForDeletion: body.dateForDeletion,
        processName: body.processName,
        status: body.status,
        statusLastUpdated: body.statusLastUpdated,
        userLastActive: body.userLastActive,
        userLastActiveSource: body.userLastActiveSource,
        userLastActiveSourceId: body.userLastActiveSourceId,
        userLastActiveUpdated: body.userLastActiveUpdated,
        emailAddressLastUpdated: body.emailAddressLastUpdated,
        emailAddressSource: body.emailAddressSource,
        emailAddressSourceId: body.emailAddressSourceId,
        hasSetupMfa: body.hasSetupMfa,
        guardrailType: "CircuitBreakerAlreadyTripped",
        contributeToAlarm: "1",
        continueProcessingRecords: "0",
        isDryRun: "0",
      }
    );

    infoSpy.mockRestore();
  });

  test("reports current and remaining records as failed when circuit breaker trips mid-batch", async () => {
    mockGetIadCircuitBreakerStatus
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);

    const event = buildSqsEvent([
      {
        commonSubjectId: "user-1",
        emailAddress: "test1@example.com",
        dateForDeletion: "2026-08-15",
        processName: "Warning30Day",
        status: "pending",
      },
      {
        commonSubjectId: "user-2",
        emailAddress: "test2@example.com",
        dateForDeletion: "2026-08-15",
        processName: "Warning30Day",
        status: "pending",
      },
      {
        commonSubjectId: "user-3",
        emailAddress: "test3@example.com",
        dateForDeletion: "2026-08-15",
        processName: "Warning30Day",
        status: "pending",
      },
    ]);

    const result = await handler(event, {} as Context);

    // First record is processed successfully before the breaker trips.
    expect(dynamoMock).toHaveReceivedCommandWith(UpdateCommand, {
      Key: { dateForDeletion: "2026-08-15", commonSubjectId: "user-1" },
    });
    expect(dynamoMock).not.toHaveReceivedCommandWith(UpdateCommand, {
      Key: { dateForDeletion: "2026-08-15", commonSubjectId: "user-2" },
    });
    expect(dynamoMock).not.toHaveReceivedCommandWith(UpdateCommand, {
      Key: { dateForDeletion: "2026-08-15", commonSubjectId: "user-3" },
    });
    // The record being processed when the breaker trips, and every record
    // after it, are reported as failed so SQS retries them later.
    expect(result).toEqual({
      batchItemFailures: [
        { itemIdentifier: "msg-1" },
        { itemIdentifier: "msg-2" },
      ],
    });
  });

  test("continues processing when circuit breaker is inactive", async () => {
    mockGetIadCircuitBreakerStatus.mockResolvedValue(false);

    await handler(
      buildSqsEvent([
        {
          commonSubjectId: "user-123",
          emailAddress: "test@example.com",
          dateForDeletion: "2026-08-15",
          processName: "Warning30Day",
          status: "pending",
        },
      ]),
      {} as Context
    );

    expect(dynamoMock).toHaveReceivedCommand(UpdateCommand);
  });

  test("processes record when environment is integration and hash matches integration hash", async () => {
    process.env.ENVIRONMENT = "integration";
    mockHashDigestValue =
      "8ecf7298e62780e2f0dadfe96184f59ed5f79cebf0fad4431348e856610fdac8"; // pragma: allowlist secret

    await handler(
      buildSqsEvent([
        {
          commonSubjectId: "user-123",
          emailAddress: "test@example.com",
          dateForDeletion: "2026-08-15",
          processName: "Warning30Day",
          status: "pending",
        },
      ]),
      {} as Context
    );

    expect(dynamoMock).toHaveReceivedCommand(UpdateCommand);

    mockHashDigestValue =
      "2dffe9978d141956695fafad3fc82b15dbcce3d79add18754991a0a714b67556"; // pragma: allowlist secret
  });

  test("skips record when environment does not match any allowed hash", async () => {
    process.env.ENVIRONMENT = "build";

    await handler(
      buildSqsEvent([
        {
          commonSubjectId: "user-123",
          emailAddress: "test@example.com",
          dateForDeletion: "2026-08-15",
          processName: "Warning30Day",
          status: "pending",
        },
      ]),
      {} as Context
    );

    expect(sqsMock).not.toHaveReceivedCommand(SendMessageCommand);
    expect(dynamoMock).not.toHaveReceivedCommand(UpdateCommand);
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
      expect.objectContaining({ commonSubjectId: "blocked-user-123" })
    );
    // two sqs calls: skipped audit event + main audit event (no notification)
    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(2);
    const sqsCalls = sqsMock.commandCalls(SendMessageCommand);

    const skippedEvent = JSON.parse(
      sqsCalls[0].args[0].input.MessageBody ?? ""
    );
    expect(skippedEvent.event_name).toBe(
      "HOME_ACCOUNT_TRACKER_NOTIFICATION_SKIPPED"
    );
    expect(skippedEvent.extensions).toEqual({
      accountTrackerNotificationSkipReason: "IndefiniteSuspension",
      accountTrackerNotificationType: "30DayWarning",
      accountTrackerAccountDeletionDate: "2026-08-15",
    });

    expect(dynamoMock).toHaveReceivedCommand(UpdateCommand);
    expect(mockMetrics.addMetric).not.toHaveBeenCalledWith(
      "notificationEnqueued",
      expect.anything(),
      1
    );
  });

  test("skips warning notification and emits UnusableAccount skipped audit event when user has not set up MFA", async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [{ commonSubjectId: "no-mfa-user", hasSetupMfa: false }],
    });

    const event = buildSqsEvent([
      {
        commonSubjectId: "no-mfa-user",
        emailAddress: "no-mfa@example.com",
        dateForDeletion: "2026-08-15",
        processName: "Warning30Day",
        status: "pending",
      },
    ]);

    await handler(event, {} as Context);

    // No warning notification is enqueued to the NotificationQueue.
    const notificationCalls = sqsMock
      .commandCalls(SendMessageCommand)
      .filter(
        (call) =>
          call.args[0].input.QueueUrl ===
          "https://sqs.eu-west-2.amazonaws.com/123456789012/NotificationQueue"
      );
    expect(notificationCalls.length).toEqual(0);

    // A NOTIFICATION_SKIPPED audit event with reason UnusableAccount is emitted.
    const txmaCall = sqsMock
      .commandCalls(SendMessageCommand)
      .find(
        (call) =>
          call.args[0].input.QueueUrl ===
          "https://sqs.eu-west-2.amazonaws.com/123456789012/TxmaQueue"
      );
    expect(txmaCall).toBeDefined();
    const auditEvent = JSON.parse(txmaCall!.args[0].input.MessageBody ?? "");
    expect(auditEvent.event_name).toBe(
      "HOME_ACCOUNT_TRACKER_NOTIFICATION_SKIPPED"
    );
    expect(auditEvent.user).toMatchObject({ user_id: "no-mfa-user" });
    expect(auditEvent.extensions).toMatchObject({
      accountTrackerNotificationSkipReason: "UnusableAccount",
    });
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
    // blocked user: skipped audit event + main audit event (2);
    // active user: notification + notification-requested audit event + main audit event (3) = 5
    expect(sqsMock).toHaveReceivedCommandTimes(SendMessageCommand, 5);
    expect(dynamoMock).toHaveReceivedCommandTimes(UpdateCommand, 2);

    const sqsCalls = sqsMock.commandCalls(SendMessageCommand);

    // 1st call: NOTIFICATION_SKIPPED for blocked user
    const skippedEvent = JSON.parse(
      sqsCalls[0].args[0].input.MessageBody ?? ""
    );
    expect(skippedEvent.event_name).toBe(
      "HOME_ACCOUNT_TRACKER_NOTIFICATION_SKIPPED"
    );
    expect(skippedEvent.user).toEqual({
      user_id: "blocked-user",
      email: "blocked@example.com",
    });
    expect(skippedEvent.extensions).toEqual({
      accountTrackerNotificationSkipReason: "IndefiniteSuspension",
      accountTrackerNotificationType: "30DayWarning",
      accountTrackerAccountDeletionDate: "2026-08-15",
    });

    // 2nd call: main audit event for blocked user (status still updated)
    const blockedMainEvent = JSON.parse(
      sqsCalls[1].args[0].input.MessageBody ?? ""
    );
    expect(blockedMainEvent.event_name).toBe(
      "HOME_ACCOUNT_TRACKER_ACCOUNT_FIRST_PERIOD_ENTERED"
    );
    expect(blockedMainEvent.user).toEqual({
      user_id: "blocked-user",
      email: "blocked@example.com",
    });

    // 3rd call: notification for active user
    expect(sqsMock).toHaveReceivedNthCommandWith(SendMessageCommand, 3, {
      QueueUrl:
        "https://sqs.eu-west-2.amazonaws.com/123456789012/NotificationQueue",
      MessageBody: JSON.stringify({
        notificationType: "INACTIVE_ACCOUNT_WARNING_30_DAY",
        emailAddress: "active@example.com",
        dateForDeletion: "2026-08-20",
      }),
    });

    // 4th call: NOTIFICATION_REQUESTED audit event for active user
    const activeRequestedEvent = JSON.parse(
      sqsCalls[3].args[0].input.MessageBody ?? ""
    );
    expect(activeRequestedEvent.event_name).toBe(
      "HOME_ACCOUNT_TRACKER_NOTIFICATION_REQUESTED"
    );
    expect(activeRequestedEvent.user).toEqual({
      user_id: "active-user",
      email: "active@example.com",
    });
    expect(activeRequestedEvent.extensions).toEqual({
      accountTrackerNotificationType: "30DayWarning",
      accountTrackerAccountDeletionDate: "2026-08-20",
    });

    // 5th call: main audit event for active user
    const activeMainEvent = JSON.parse(
      sqsCalls[4].args[0].input.MessageBody ?? ""
    );
    expect(activeMainEvent.event_name).toBe(
      "HOME_ACCOUNT_TRACKER_ACCOUNT_FIRST_PERIOD_ENTERED"
    );
    expect(activeMainEvent.user).toEqual({
      user_id: "active-user",
      email: "active@example.com",
    });
    expect(activeMainEvent.extensions).toEqual({
      accountTrackerAccountDeletionDate: "2026-08-20",
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
    // per record: notification + notification-requested audit event + main audit event (3) x 2 = 6
    expect(sqsMock).toHaveReceivedCommandTimes(SendMessageCommand, 6);
    expect(dynamoMock).toHaveReceivedCommandTimes(UpdateCommand, 2);
    expect(mockMetrics.publishStoredMetrics).toHaveBeenCalledTimes(1);
  });

  test("reports failed record in batchItemFailures when SQS send fails", async () => {
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

    const result = await handler(event, {} as Context);

    expect(result).toEqual({
      batchItemFailures: [{ itemIdentifier: "msg-0" }],
    });
  });

  test("reports failed record in batchItemFailures when process configuration is not found", async () => {
    const event = buildSqsEvent([
      {
        commonSubjectId: "user-123",
        emailAddress: "test@example.com",
        dateForDeletion: "2026-08-15",
        processName: "UnknownProcess",
        status: "pending",
      },
    ]);

    const result = await handler(event, {} as Context);

    expect(result).toEqual({
      batchItemFailures: [{ itemIdentifier: "msg-0" }],
    });
  });

  test("reports failed record in batchItemFailures when DynamoDB update fails", async () => {
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

    const result = await handler(event, {} as Context);

    expect(result).toEqual({
      batchItemFailures: [{ itemIdentifier: "msg-0" }],
    });
  });

  test("processes remaining records in the batch when one record fails", async () => {
    dynamoMock
      .on(UpdateCommand, {
        Key: { dateForDeletion: "2026-08-15", commonSubjectId: "user-fail" },
      })
      .rejects(new Error("DynamoDB update failed"));

    const event = buildSqsEvent([
      {
        commonSubjectId: "user-fail",
        emailAddress: "test@example.com",
        dateForDeletion: "2026-08-15",
        processName: "Warning30Day",
        status: "pending",
      },
      {
        commonSubjectId: "user-ok",
        emailAddress: "test2@example.com",
        dateForDeletion: "2026-08-15",
        processName: "Warning30Day",
        status: "pending",
      },
    ]);

    const result = await handler(event, {} as Context);

    expect(result).toEqual({
      batchItemFailures: [{ itemIdentifier: "msg-0" }],
    });
    expect(dynamoMock).toHaveReceivedCommandWith(UpdateCommand, {
      Key: { dateForDeletion: "2026-08-15", commonSubjectId: "user-ok" },
    });
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

    expect(sqsMock).toHaveReceivedCommandTimes(SendMessageCommand, 2);
    expect(sqsMock).toHaveReceivedNthCommandWith(SendMessageCommand, 1, {
      QueueUrl:
        "https://sqs.eu-west-2.amazonaws.com/123456789012/AccountDeletionQueue",
      MessageBody: JSON.stringify({
        publicSubjectId: "public-123",
        commonSubjectId: "user-123",
      }),
    });

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
      "HOME_ACCOUNT_TRACKER_ACCOUNT_DELETION_REQUESTED"
    );

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

    expect(sqsMock).toHaveReceivedCommandTimes(SendMessageCommand, 3);
    expect(sqsMock).toHaveReceivedNthCommandWith(SendMessageCommand, 1, {
      QueueUrl:
        "https://sqs.eu-west-2.amazonaws.com/123456789012/NotificationQueue",
      MessageBody: JSON.stringify({
        notificationType: "INACTIVE_ACCOUNT_WARNING_30_DAY",
        emailAddress: "test@example.com",
        dateForDeletion: "2026-08-15",
      }),
    });

    expect(sqsMock).toHaveReceivedNthCommandWith(SendMessageCommand, 2, {
      QueueUrl: "https://sqs.eu-west-2.amazonaws.com/123456789012/TxmaQueue",
      MessageBody: expect.stringContaining(
        '"event_name":"HOME_ACCOUNT_TRACKER_NOTIFICATION_REQUESTED"'
      ),
    });

    expect(sqsMock).toHaveReceivedNthCommandWith(SendMessageCommand, 3, {
      QueueUrl: "https://sqs.eu-west-2.amazonaws.com/123456789012/TxmaQueue",
      MessageBody: expect.stringContaining(
        '"event_name":"HOME_ACCOUNT_TRACKER_ACCOUNT_FIRST_PERIOD_ENTERED"'
      ),
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
    dynamoMock
      .on(QueryCommand, {
        TableName: "test-inactive-tracker-table",
        IndexName: "CommonSubjectIdIndex",
      })
      .resolves({
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

    // expect strictly one call to sqs, for audit event
    // expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(1);
    // check the correct txma event is being sent out
    const sqsCalls = sqsMock.commandCalls(SendMessageCommand);
    const txmaCallInput = sqsCalls[0].args[0].input;

    expect(txmaCallInput.QueueUrl).toEqual(
      "https://sqs.eu-west-2.amazonaws.com/123456789012/TxmaQueue"
    );

    const txmaEventBody = JSON.parse(txmaCallInput.MessageBody ?? "");

    expect(txmaEventBody).toEqual({
      event_name: "HOME_ACCOUNT_TRACKER_NOTIFICATION_SKIPPED",
      component_id: "https://home.account.gov.uk",
      timestamp: expect.any(Number),
      event_timestamp_ms: expect.any(Number),
      event_timestamp_ms_formatted: expect.any(String),
      user: {
        user_id: "undeliverablee",
        email: "i-am-not-deliverable@undlvrbl.com",
      },
      extensions: {
        accountTrackerNotificationSkipReason: "PreviouslyUndeliverable",
        accountTrackerNotificationType: "30DayWarning",
        accountTrackerAccountDeletionDate: "2026-08-30",
      },
    });
    expect(mockMetrics.addMetric).not.toHaveBeenCalledWith(
      "notificationEnqueued",
      expect.anything()
    );
    // status should still be updated in the inactive account tracker
    expect(dynamoMock).toHaveReceivedCommand(UpdateCommand);
  });

  test("continue as expected where there is no hasUndeliverableEmailAddress flag", async () => {
    dynamoMock
      .on(QueryCommand, {
        TableName: "test-inactive-tracker-table",
        IndexName: "EmailAddressIndex",
      })
      .resolves({
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
    expect(mockMetrics.addMetric).toHaveBeenCalledWith(
      "notificationEnqueued",
      expect.anything(),
      1
    );
  });

  test("skips processing when doesNotHaveEmailAddress guard returns Abort", async () => {
    mockDoesNotHaveEmailAddress.mockResolvedValue(doesNotHaveEmailAddressAbort);

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

    expect(mockDoesNotHaveEmailAddress).toHaveBeenCalledWith(
      expect.objectContaining({
        commonSubjectId: "user-no-email",
        emailAddress: "",
        dateForDeletion: "2026-08-15",
      })
    );
    expect(sqsMock).not.toHaveReceivedCommand(SendMessageCommand);
    expect(dynamoMock).not.toHaveReceivedCommand(UpdateCommand);
  });

  test("skips notification but still updates status when inactive account deletion feature flag guard is activated", async () => {
    mockSendInactiveAccountEmailsIsDisabled.mockResolvedValue(
      inactiveAccountEmailsFeatureFlagDisabled
    );

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

    expect(mockSendInactiveAccountEmailsIsDisabled).toHaveBeenCalled();
    expect(sqsMock).not.toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl:
        "https://sqs.eu-west-2.amazonaws.com/123456789012/NotificationQueue",
    });
    expect(dynamoMock).toHaveReceivedCommand(UpdateCommand);
    expect(mockMetrics.addMetric).not.toHaveBeenCalledWith(
      "notificationEnqueued",
      expect.anything(),
      1
    );
  });

  test("includes additional user and extension details in the audit event when sendAdditionalAuditEventDetails is set", async () => {
    process.env.FEATURE_SEND_IAD_AUDIT_EVENTS = "true";
    process.env.ACCOUNT_DELETION_QUEUE_URL =
      "https://sqs.eu-west-2.amazonaws.com/123456789012/AccountDeletionQueue";

    const event = buildSqsEvent([
      {
        commonSubjectId: "user-123",
        publicSubjectId: "public-123",
        emailAddress: "test@example.com",
        dateForDeletion: "2026-08-15",
        userLastActive: "2021-10-01",
        userLastActiveSource: "AUTH_TOKEN_SENT_TO_ORCHESTRATION",
        userLastActiveSourceId: "event-guid",
        processName: "DeleteAccount",
        status: "pending",
      },
    ]);

    await handler(event, {} as Context);

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
      "HOME_ACCOUNT_TRACKER_ACCOUNT_DELETION_REQUESTED"
    );
    expect(auditEvent.user).toMatchObject({
      user_id: "user-123",
      email: "test@example.com",
      public_subject_id: "public-123",
    });
    expect(auditEvent.extensions).toMatchObject({
      accountTrackerAccountDeletionDate: "2026-08-15",
      accountTrackerAccountLastAccessDate: "2021-10-01",
      accountTrackerAccountLastAccessSource: "AUTH_TOKEN_SENT_TO_ORCHESTRATION",
      accountTrackerAccountLastAccessSourceEventId: "event-guid",
    });
  });

  test("sends only base audit event details when sendAdditionalAuditEventDetails is not set", async () => {
    process.env.FEATURE_SEND_IAD_AUDIT_EVENTS = "true";

    const event = buildSqsEvent([
      {
        commonSubjectId: "user-123",
        publicSubjectId: "public-123",
        emailAddress: "test@example.com",
        dateForDeletion: "2026-08-15",
        userLastActive: "2021-10-01",
        userLastActiveSource: "AUTH_TOKEN_SENT_TO_ORCHESTRATION",
        userLastActiveSourceId: "event-guid",
        processName: "Warning30Day",
        status: "pending",
      },
    ]);

    await handler(event, {} as Context);

    const txmaCall = sqsMock
      .commandCalls(SendMessageCommand)
      .find(
        (call) =>
          call.args[0].input.QueueUrl ===
            "https://sqs.eu-west-2.amazonaws.com/123456789012/TxmaQueue" &&
          (call.args[0].input.MessageBody ?? "").includes(
            "HOME_ACCOUNT_TRACKER_ACCOUNT_FIRST_PERIOD_ENTERED"
          )
      );
    expect(txmaCall).toBeDefined();

    const auditEvent = JSON.parse(
      txmaCall!.args[0].input.MessageBody as string
    );
    expect(auditEvent.user).toEqual({
      user_id: "user-123",
      email: "test@example.com",
    });
    expect(auditEvent.extensions).toEqual({
      accountTrackerAccountDeletionDate: "2026-08-15",
    });
  });

  test("does not send emails when dateForDeletion is 27th October", async () => {
    dynamoMock
      .on(QueryCommand, {
        TableName: "test-inactive-tracker-table",
        IndexName: "CommonSubjectIdIndex",
      })
      .resolves({
        Items: [
          {
            commonSubjectId: "migratedverifyuser",
            emailAddress: "i-might-be-a-migrated-verify@user.com",
            dateForDeletion: "2026-10-27",
          },
        ],
      });

    const event = buildSqsEvent([
      {
        commonSubjectId: "migratedverifyuser",
        emailAddress: "i-might-be-a-migrated-verify@user.com",
        dateForDeletion: "2026-10-27",
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
        ":id": "migratedverifyuser",
      },
    });

    // expect strictly two calls to sqs, for audit events
    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(2);
    // check the correct txma event is being sent out
    const sqsCalls = sqsMock.commandCalls(SendMessageCommand);
    const txmaCallInput = sqsCalls[0].args[0].input;

    expect(txmaCallInput.QueueUrl).toEqual(
      "https://sqs.eu-west-2.amazonaws.com/123456789012/TxmaQueue"
    );

    const txmaEventBody = JSON.parse(txmaCallInput.MessageBody ?? "");

    expect(txmaEventBody).toEqual({
      event_name: "HOME_ACCOUNT_TRACKER_NOTIFICATION_SKIPPED",
      component_id: "https://home.account.gov.uk",
      timestamp: expect.any(Number),
      event_timestamp_ms: expect.any(Number),
      event_timestamp_ms_formatted: expect.any(String),
      user: {
        user_id: "migratedverifyuser",
        email: "i-might-be-a-migrated-verify@user.com",
      },
      extensions: {
        accountTrackerNotificationSkipReason: "LikelyVerifyMigratedUser",
        accountTrackerNotificationType: "30DayWarning",
        accountTrackerAccountDeletionDate: "2026-10-27",
      },
    });

    const txmaCallInput2 = sqsCalls[1].args[0].input;
    const txmaEventBody2 = JSON.parse(txmaCallInput2.MessageBody ?? "");
    expect(txmaEventBody2).toEqual(
      expect.objectContaining({
        event_name: "HOME_ACCOUNT_TRACKER_ACCOUNT_FIRST_PERIOD_ENTERED",
        extensions: {
          accountTrackerAccountDeletionDate: "2026-10-27",
        },
      })
    );

    expect(mockMetrics.addMetric).not.toHaveBeenCalledWith(
      "notificationEnqueued",
      expect.anything()
    );
    // status should still be updated in the inactive account tracker
    expect(dynamoMock).toHaveReceivedCommand(UpdateCommand);
  });

  describe("guard short-circuit behaviour", () => {
    test("when an abort guard activates, continueWithoutActions guards are not run", async () => {
      mockDoesNotHaveEmailAddress.mockResolvedValue(
        doesNotHaveEmailAddressAbort
      );

      await handler(
        buildSqsEvent([
          {
            commonSubjectId: "user-no-email",
            emailAddress: "",
            dateForDeletion: "2026-08-15",
            processName: "Warning30Day",
            status: "pending",
          },
        ]),
        {} as Context
      );

      expect(mockSendInactiveAccountEmailsIsDisabled).not.toHaveBeenCalled();
      expect(mockHasAisBlockIntervention).not.toHaveBeenCalled();
    });

    test("when the first continueWithoutActions guard activates, subsequent ones are not run", async () => {
      mockSendInactiveAccountEmailsIsDisabled.mockResolvedValue(
        inactiveAccountEmailsFeatureFlagDisabled
      );

      await handler(
        buildSqsEvent([
          {
            commonSubjectId: "user-123",
            emailAddress: "user@example.com",
            dateForDeletion: "2026-08-15",
            processName: "Warning30Day",
            status: "pending",
          },
        ]),
        {} as Context
      );

      expect(mockHasAisBlockIntervention).not.toHaveBeenCalled();
    });
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
              Key: {
                dateForDeletion: "2031-01-01",
                commonSubjectId: "dup-user",
              },
            }),
          }),
        ]),
      });
      expect(dynamoMock).toHaveReceivedCommandWith(TransactWriteCommand, {
        TransactItems: expect.not.arrayContaining([
          expect.objectContaining({
            Delete: expect.objectContaining({
              Key: {
                dateForDeletion: "2031-06-01",
                commonSubjectId: "dup-user",
              },
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
        UpdateExpression:
          "SET #status = :status, statusLastUpdated = :timestamp",
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
        UpdateExpression:
          "SET #status = :status, statusLastUpdated = :timestamp",
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
