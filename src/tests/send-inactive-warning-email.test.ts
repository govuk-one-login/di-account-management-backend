import { vi, describe, test, expect, beforeEach } from "vitest";
import { Context, SQSEvent } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import "aws-sdk-client-mock-vitest";

const mockMetrics = vi.hoisted(() => ({
  publishStoredMetrics: vi.fn(),
  addMetric: vi.fn(),
}));
const mockInitMetrics = vi.hoisted(() => vi.fn(() => mockMetrics));

vi.mock("../common/metrics.js", () => ({
  initMetrics: mockInitMetrics,
}));

import { handler } from "../send-inactive-warning-email.js";

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

describe("send-inactive-warning-email handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sqsMock.reset();
    dynamoMock.reset();
    sqsMock.on(SendMessageCommand).resolves({ MessageId: "test-message-id" });
    dynamoMock.on(UpdateCommand).resolves({});

    process.env.NOTIFICATION_QUEUE_URL = "https://sqs.eu-west-2.amazonaws.com/123456789012/NotificationQueue";
    process.env.INACTIVE_ACCOUNT_TRACKER_TABLE_NAME = "test-inactive-tracker-table";
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
      QueueUrl: "https://sqs.eu-west-2.amazonaws.com/123456789012/NotificationQueue",
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
    expect(mockMetrics.addMetric).toHaveBeenCalledWith("notificationEnqueued", expect.anything(), 1);
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
      QueueUrl: "https://sqs.eu-west-2.amazonaws.com/123456789012/NotificationQueue",
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
    expect(mockMetrics.addMetric).toHaveBeenCalledWith("notificationEnqueued", expect.anything(), 1);
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

    await expect(handler(event, {} as Context)).rejects.toThrow("SQS send failed");
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

    await expect(handler(event, {} as Context)).rejects.toThrow("DynamoDB update failed");
  });

  test("throws when process has no target status configured", async () => {
    const event = buildSqsEvent([
      {
        commonSubjectId: "user-123",
        emailAddress: "test@example.com",
        dateForDeletion: "2026-08-15",
        processName: "DeleteAccount",
        status: "pending",
      },
    ]);

    await expect(handler(event, {} as Context)).rejects.toThrow(
      "No notification type configured for process DeleteAccount"
    );
  });
});
