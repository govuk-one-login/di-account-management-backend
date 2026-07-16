import { vi, describe, test, expect, beforeEach } from "vitest";
import { Context, SQSEvent } from "aws-lambda";

const mockMetrics = vi.hoisted(() => ({
  publishStoredMetrics: vi.fn(),
}));
const mockInitMetrics = vi.hoisted(() => vi.fn(() => mockMetrics));

vi.mock("../common/metrics.js", () => ({
  initMetrics: mockInitMetrics,
}));

import { handler } from "../send-inactive-warning-email.js";

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
  });

  test("processes SQS records and publishes metrics", async () => {
    const event = buildSqsEvent([
      {
        commonSubjectId: "user-123",
        emailAddress: "test@example.com",
        dateForDeletion: "2026-08-15",
        processName: "Warning30Day",
      },
    ]);

    await handler(event, {} as Context);
    expect(mockMetrics.publishStoredMetrics).toHaveBeenCalledTimes(1);
  });

  test("processes multiple records from a batch", async () => {
    const event = buildSqsEvent([
      { commonSubjectId: "user-1", processName: "Warning30Day" },
      { commonSubjectId: "user-2", processName: "Warning7Day" },
    ]);

    await handler(event, {} as Context);
    expect(mockMetrics.publishStoredMetrics).toHaveBeenCalledTimes(1);
  });
});
