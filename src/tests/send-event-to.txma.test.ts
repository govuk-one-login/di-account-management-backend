import "aws-sdk-client-mock-jest";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { mockClient } from "aws-sdk-client-mock";

import {
  handler,
  sendAuditEvent,
  sendSqsMessage,
  transformToTxMAEvent,
} from "../send-suspicious-activity";
import { SuspiciousActivityEvent } from "../common/model";
import { SNSEvent, SNSEventRecord, SNSMessage } from "aws-lambda";

const TEST_SNS_MESSAGE: SNSMessage = {
  SignatureVersion: "SignatureVersion",
  Timestamp: "Timestamp",
  Signature: "Signature",
  SigningCertUrl: "SigningCertUrl",
  MessageId: "MessageId",
  Message: JSON.stringify({
    user_id: "1234567",
    email_address: "test@test.com",
    persistent_session_id: "111111",
    session_id: "111112",
    reported: true,
    reported_event: {
      event_type: "HOME_REPORT_SUSPICIOUS_ACTIVITY",
      session_id: "111111",
      user_id: "1111111",
      timestamp: 1609462861,
      activities: {
        type: "HOME_REPORT_SUSPICIOUS_ACTIVITY",
        client_id: "111111",
        timestamp: 1609462861,
        event_id: "1111111",
      },
    },
  }),
  MessageAttributes: {},
  Type: "Type",
  UnsubscribeUrl: "unsubscribeUrl",
  TopicArn: "TopicArn",
  Subject: "Subject",
};

const TEST_SNS_EVENT_RECORD: SNSEventRecord = {
  EventVersion: "1",
  EventSubscriptionArn: "arn",
  EventSource: "source",
  Sns: TEST_SNS_MESSAGE,
};

export const TEST_SNS_EVENT: SNSEvent = {
  Records: [TEST_SNS_EVENT_RECORD],
};

const sqsMock = mockClient(SQSClient);
const EVENT_NAME = "HOME_REPORT_SUSPICIOUS_ACTIVITY";
const TXMA_QUEUE_URL = "TXMA_QUEUE_URL";

describe("sendAuditEventToTxMA", () => {
  beforeEach(() => {
    sqsMock.reset();
    sqsMock.on(SendMessageCommand).resolves({ MessageId: "MessageId" });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("send audit event successfully", async () => {
    const consoleLog = jest.spyOn(console, "log").mockImplementation();
    const txMAEvent = {
      event_id: "event-id",
      client_id: "client-id",
      timestamp: 1726268400,
      event_timestamp_ms: 1726268400,
      event_timestamp_ms_formatted: "2024-09-13T23:00:00.000Z",
      component_id: "https://home.account.gov.uk",
      event_name: "HOME_REPORT_SUSPICIOUS_ACTIVITY",
      extensions: {
        reported_session_id: "111111",
      },
      user: {
        persistent_session_id: "111111",
        session_id: "111112",
        user_id: "1234567",
      },
    };
    await sendAuditEvent(txMAEvent, TXMA_QUEUE_URL);
    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(1);
    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl: "TXMA_QUEUE_URL",
      MessageBody: JSON.stringify(txMAEvent),
    });
    expect(consoleLog).toHaveBeenCalledWith(
      "[Message sent to QUEUE] with message id = MessageId"
    );
  });

  test("send audit event fails and handles error correctly", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation();
    const txMAEvent = {
      event_id: "event-id",
      client_id: "client-id",
      timestamp: 1726268400,
      event_timestamp_ms: 1726268400,
      event_timestamp_ms_formatted: "2024-09-13T23:00:00.000Z",
      component_id: "https://home.account.gov.uk",
      event_name: "HOME_REPORT_SUSPICIOUS_ACTIVITY",
      extensions: {
        reported_session_id: "111111",
      },
      user: {
        persistent_session_id: "111111",
        session_id: "111112",
        user_id: "1234567",
      },
    };

    sqsMock.on(SendMessageCommand).rejects("SomeSQSError");
    await expect(
      sendAuditEvent(txMAEvent, TXMA_QUEUE_URL)
    ).rejects.toMatchObject({
      message: "SomeSQSError",
    });
    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl: "TXMA_QUEUE_URL",
      MessageBody: JSON.stringify(txMAEvent),
    });
    expect(consoleError).toHaveBeenCalledWith(
      "Error occurred trying to send the audit event to the TxMA queue: SomeSQSError"
    );
  });
});

describe("sendSQSMessage", () => {
  beforeEach(() => {
    process.env.TXMA_QUEUE_URL = TXMA_QUEUE_URL;
    sqsMock.reset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("send sqs successfully", async () => {
    const txMAEvent = {
      component_id: "https://home.account.gov.uk",
      event_name: "HOME_REPORT_SUSPICIOUS_ACTIVITY",
      extensions: {
        reported_session_id: "111111",
      },
      user: {
        persistent_session_id: "111111",
        session_id: "111112",
        user_id: "1234567",
      },
    };
    await sendSqsMessage(JSON.stringify(txMAEvent), "TXMA_QUEUE_URL");
    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(1);
    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl: "TXMA_QUEUE_URL",
      MessageBody: JSON.stringify(txMAEvent),
    });
  });
});

describe("transform", () => {
  let suspiciousActivityEvent: SuspiciousActivityEvent;
  beforeEach(() => {
    process.env.EVENT_NAME = EVENT_NAME;
    suspiciousActivityEvent = {
      user_id: "1234567",
      email_address: "test@test.com",
      persistent_session_id: "111111",
      session_id: "111112",
      reported: true,
      reported_event: {
        event_type: "HOME_REPORT_SUSPICIOUS_ACTIVITY",
        session_id: "111111",
        user_id: "1111111",
        timestamp: 1609462861,
        activities: {
          type: "HOME_REPORT_SUSPICIOUS_ACTIVITY",
          client_id: "111111",
          timestamp: 1609462861,
          event_id: "1111111",
        },
      },
    };
    jest.useFakeTimers();
    jest.setSystemTime(new Date(Date.UTC(2023, 20, 12)));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test("transforms suspicious activity event to TxMA event successfully", async () => {
    const txMAEvent = await transformToTxMAEvent(
      suspiciousActivityEvent,
      EVENT_NAME
    );
    const expected = {
      timestamp: 1726099200,
      event_timestamp_ms: 1726099200000,
      event_timestamp_ms_formatted: "2024-09-12T00:00:00.000Z",
      component_id: "https://home.account.gov.uk",
      event_name: "HOME_REPORT_SUSPICIOUS_ACTIVITY",
      extensions: {
        reported_session_id: "111111",
      },
      user: {
        persistent_session_id: "111111",
        session_id: "111112",
        user_id: "1234567",
      },
    };
    expect(txMAEvent).toEqual(expected);
  });

  test("transforms when event name is not recognized", () => {
    expect(() => {
      transformToTxMAEvent(suspiciousActivityEvent, "ANOTHER_NAME");
    }).toThrowError(
      new Error(
        "Unsupported event - There is no transformation logic for this event"
      )
    );
  });
});

describe("handler", () => {
  beforeEach(() => {
    sqsMock.reset();
    process.env.EVENT_NAME = "HOME_REPORT_SUSPICIOUS_ACTIVITY";
    process.env.TXMA_QUEUE_URL = "TXMA_QUEUE_URL";
    sqsMock.on(SendMessageCommand).resolves({ MessageId: "MessageId" });
    jest.useFakeTimers();
    jest.setSystemTime(new Date(Date.UTC(2023, 20, 12)));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test("handler successfully sends audit event to txma", async () => {
    const consoleLog = jest.spyOn(console, "log").mockImplementation();
    await handler(TEST_SNS_EVENT);
    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(1);
    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl: "TXMA_QUEUE_URL",
      MessageBody: JSON.stringify({
        timestamp: 1726099200,
        event_timestamp_ms: 1726099200000,
        event_timestamp_ms_formatted: "2024-09-12T00:00:00.000Z",
        component_id: "https://home.account.gov.uk",
        event_name: "HOME_REPORT_SUSPICIOUS_ACTIVITY",
        user: {
          user_id: "1234567",
          persistent_session_id: "111111",
          session_id: "111112",
        },
        extensions: {
          reported_session_id: "111111",
        },
      }),
    });
    expect(consoleLog).toHaveBeenCalledWith(
      "[Message sent to QUEUE] with message id = MessageId"
    );
  });
});

describe("handler error handling", () => {
  let consoleErrorMock: jest.SpyInstance;

  beforeEach(() => {
    sqsMock.reset();
    process.env.EVENT_NAME = "ANOTHER_EVENT_NAME";
    process.env.DLQ_URL = "DLQ_URL";
    consoleErrorMock = jest.spyOn(global.console, "error").mockImplementation();
    sqsMock.on(SendMessageCommand).resolves({ MessageId: "MessageId" });
  });

  afterEach(() => {
    consoleErrorMock.mockRestore();
    jest.clearAllMocks();
  });

  test("logs the error message", async () => {
    await handler(TEST_SNS_EVENT);
    expect(consoleErrorMock).toHaveBeenCalledTimes(1);
  });

  test("sends the event to the DLQ", async () => {
    await handler(TEST_SNS_EVENT);
    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(1);
    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl: "DLQ_URL",
      MessageBody: TEST_SNS_EVENT.Records[0].Sns.Message,
    });
  });
});
