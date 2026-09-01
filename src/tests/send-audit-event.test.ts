import {
  vi,
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
} from "vitest";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { mockClient } from "aws-sdk-client-mock";
import "aws-sdk-client-mock-vitest";
import { Logger } from "@aws-lambda-powertools/logger";

import {
  sendAuditEvent,
  buildTxmaEvent,
  AuditEventParameters,
} from "../common/send-audit-event.js";
import { COMPONENT_ID } from "../common/constants.js";

const sqsMock = mockClient(SQSClient);
const TXMA_QUEUE_URL = "TXMA_QUEUE_URL";

const parameters: AuditEventParameters = {
  user: {
    user_id: "user-id-123",
    session_id: "session-id-123",
  },
  event_id: "event-id-123",
  client_id: "client-id-123",
  extensions: {
    reported_session_id: "reported-session-id-123",
  },
};

describe("buildTxmaEvent", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-02-26T18:24:46.515Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  test("builds a TxMA event with generated timestamps and default component_id", () => {
    const event = buildTxmaEvent("HOME_TEST_EVENT", parameters);

    expect(event).toEqual({
      event_name: "HOME_TEST_EVENT",
      component_id: COMPONENT_ID,
      timestamp: Math.floor(Date.parse("2024-02-26T18:24:46.515Z") / 1000),
      event_timestamp_ms: Date.parse("2024-02-26T18:24:46.515Z"),
      event_timestamp_ms_formatted: "2024-02-26T18:24:46.515Z",
      user: parameters.user,
      event_id: "event-id-123",
      client_id: "client-id-123",
      extensions: parameters.extensions,
    });
  });

  test("uses explicit timestamps and component_id when provided", () => {
    const event = buildTxmaEvent("HOME_TEST_EVENT", {
      user: { user_id: "user-id-123" },
      timestamp: 1000,
      event_timestamp_ms: 1000000,
      event_timestamp_ms_formatted: "1970-01-01T00:16:40.000Z",
      component_id: "https://custom.example.com",
    });

    expect(event).toEqual({
      event_name: "HOME_TEST_EVENT",
      component_id: "https://custom.example.com",
      timestamp: 1000,
      event_timestamp_ms: 1000000,
      event_timestamp_ms_formatted: "1970-01-01T00:16:40.000Z",
      user: { user_id: "user-id-123" },
    });
  });
});

describe("sendAuditEvent", () => {
  beforeEach(() => {
    sqsMock.reset();
    sqsMock.on(SendMessageCommand).resolves({ MessageId: "MessageId" });
    process.env.AWS_REGION = "AWS_REGION";
    process.env.TXMA_QUEUE_URL = TXMA_QUEUE_URL;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-02-26T18:24:46.515Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    delete process.env.TXMA_QUEUE_URL;
    delete process.env.FEATURE_SEND_IAD_AUDIT_EVENTS;
  });

  test("builds the event and sends it to the queue from the environment variable", async () => {
    const loggerInfo = vi
      .spyOn(Logger.prototype, "info")
      .mockImplementation(() => undefined);

    await sendAuditEvent("HOME_TEST_EVENT", parameters);

    const expectedEvent = buildTxmaEvent("HOME_TEST_EVENT", parameters);
    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(1);
    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl: TXMA_QUEUE_URL,
      MessageBody: JSON.stringify(expectedEvent),
    });
    expect(loggerInfo).toHaveBeenCalledWith(
      "[Message sent to QUEUE] with message id = MessageId"
    );
  });

  test("throws when the TXMA_QUEUE_URL environment variable is not set", async () => {
    delete process.env.TXMA_QUEUE_URL;

    await expect(
      sendAuditEvent("HOME_TEST_EVENT", parameters)
    ).rejects.toThrowError('Environment variable "TXMA_QUEUE_URL" is not set.');
  });

  test("logs and rethrows when sending fails", async () => {
    const loggerError = vi
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    sqsMock.on(SendMessageCommand).rejects("SomeSQSError");

    await expect(
      sendAuditEvent("HOME_TEST_EVENT", parameters)
    ).rejects.toMatchObject({
      message: "SomeSQSError",
    });
    expect(loggerError).toHaveBeenCalledWith(
      "Error occurred trying to send the audit event to the TxMA queue: SomeSQSError"
    );
  });

  describe("IAD event skipping", () => {
    const IAD_EVENTS = [
      "HOME_ACCOUNT_TRACKER_ACCOUNT_DELETION_REQUESTED",
      "HOME_ACCOUNT_TRACKER_ACCOUNT_FIRST_PERIOD_ENTERED",
      "HOME_ACCOUNT_TRACKER_ACCOUNT_REACTIVATED",
      "HOME_ACCOUNT_TRACKER_ACCOUNT_SECOND_PERIOD_ENTERED",
      "HOME_ACCOUNT_TRACKER_NOTIFICATION_DELIVERY_PERMANENTLY_FAILED",
      "HOME_ACCOUNT_TRACKER_NOTIFICATION_SKIPPED",
      "HOME_ACCOUNT_TRACKER_NOTIFICATION_REQUESTED",
      "HOME_ACCOUNT_TRACKER_RECORD_DELETED",
    ];

    test.each(IAD_EVENTS)(
      "throws sending %s when FEATURE_SEND_IAD_AUDIT_EVENTS is not set",
      async (eventName) => {
        await expect(
          sendAuditEvent(eventName, parameters)
        ).rejects.toThrowError(
          'Environment variable "FEATURE_SEND_IAD_AUDIT_EVENTS" is not set.'
        );

        expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(0);
      }
    );

    test.each(IAD_EVENTS)(
      "skips sending %s when FEATURE_SEND_IAD_AUDIT_EVENTS is 'false'",
      async (eventName) => {
        process.env.FEATURE_SEND_IAD_AUDIT_EVENTS = "false";
        const loggerInfo = vi
          .spyOn(Logger.prototype, "info")
          .mockImplementation(() => undefined);

        const result = await sendAuditEvent(eventName, parameters);

        expect(result).toBeUndefined();
        expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(0);
        expect(loggerInfo).toHaveBeenCalledWith(
          `Skipping IAD event ${eventName} because IAD audit events are disabled`
        );
      }
    );

    test.each(IAD_EVENTS)(
      "sends %s when FEATURE_SEND_IAD_AUDIT_EVENTS is 'true'",
      async (eventName) => {
        process.env.FEATURE_SEND_IAD_AUDIT_EVENTS = "true";
        vi.spyOn(Logger.prototype, "info").mockImplementation(() => undefined);

        const result = await sendAuditEvent(eventName, parameters);

        expect(result).toEqual({ MessageId: "MessageId" });
        expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(1);
      }
    );

    test("sends non-IAD events regardless of feature flag being disabled", async () => {
      delete process.env.FEATURE_SEND_IAD_AUDIT_EVENTS;
      vi.spyOn(Logger.prototype, "info").mockImplementation(() => undefined);

      const result = await sendAuditEvent("HOME_TEST_EVENT", parameters);

      expect(result).toEqual({ MessageId: "MessageId" });
      expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(1);
    });
  });
});
