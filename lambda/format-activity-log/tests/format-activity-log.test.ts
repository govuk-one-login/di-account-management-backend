import { mockClient } from "aws-sdk-client-mock";
import "aws-sdk-client-mock-jest";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { SQSEvent, SQSRecord } from "aws-lambda";
import {
  formatIntoActivitLogEntry,
  handler,
  sendSqsMessage,
  validateTxmaEventBody,
  validateUser,
  validateUserActivityLog,
} from "../format-activity-log";
import { ActivityLogEntry, UserActivityLog } from "../models";
import {
  TEST_ACTIVITY_LOG_ENTRY,
  TEST_ACTIVITY_LOG_ENTRY_WITH_TWO_ACTIVITIES,
  TEST_SQS_EVENT,
  TEST_USER_ACTIVITY_LOG_UNDEFINED_LOG_ENTRY,
  TEST_USER_ACTIVITY_SECOND_TXMA_EVENT,
  activity,
  messageId,
  queueUrl,
  secondEventType,
  sessionId,
  tableName,
  userId,
} from "./test-helper";

const sqsMock = mockClient(SQSClient);

describe("handler", () => {
  beforeEach(() => {
    sqsMock.reset();
    process.env.TABLE_NAME = tableName;
    process.env.OUTPUT_QUEUE_URL = queueUrl;
    sqsMock.on(SendMessageCommand).resolves({ MessageId: messageId });
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("it writes a formatted SQS event when activityLogEntry is empty", async () => {
    await handler(TEST_SQS_EVENT);
    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(2);
    expect(sqsMock).toHaveReceivedNthCommandWith(1, SendMessageCommand, {
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(TEST_ACTIVITY_LOG_ENTRY),
    });
    expect(sqsMock).toHaveReceivedNthCommandWith(2, SendMessageCommand, {
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(TEST_ACTIVITY_LOG_ENTRY),
    });
  });

  describe("error handing ", () => {
    let consoleErrorMock: jest.SpyInstance;
    const invalidTxmaEvent = JSON.parse(JSON.stringify({}));
    const invalidUserActivityLog: UserActivityLog = {
      txmaEvent: invalidTxmaEvent,
      activityLogEntry: undefined,
    };
    const INVALID_SQS_RECORD: SQSRecord = {
      body: JSON.stringify(invalidUserActivityLog),
      messageId: "",
      receiptHandle: "",
      attributes: {
        ApproximateReceiveCount: "1",
        SentTimestamp: "",
        SenderId: "",
        ApproximateFirstReceiveTimestamp: "",
      },
      messageAttributes: {},
      md5OfBody: "",
      eventSource: "",
      eventSourceARN: "",
      awsRegion: "",
    };
    const INVALID_SQS_EVENT: SQSEvent = {
      Records: [INVALID_SQS_RECORD],
    };

    beforeEach(() => {
      consoleErrorMock = jest
        .spyOn(global.console, "error")
        .mockImplementation();

      sqsMock.reset();
      process.env.TABLE_NAME = tableName;
      process.env.OUTPUT_QUEUE_URL = queueUrl;
      sqsMock.on(SendMessageCommand).resolves({ MessageId: messageId });
    });

    afterEach(() => {
      jest.clearAllMocks();
      consoleErrorMock.mockRestore();
    });

    test("logs the error message", async () => {
      await handler(INVALID_SQS_EVENT);
      expect(consoleErrorMock).toHaveBeenCalledTimes(1);
    });

    test("sends the event to dead letter queue", async () => {
      await handler(INVALID_SQS_EVENT);
      expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(1);
    });
  });
});

describe("formatIntoActivitLogEntry", () => {
  test("txma event with no existing ActivityLogEntry", () => {
    expect(
      formatIntoActivitLogEntry(TEST_USER_ACTIVITY_LOG_UNDEFINED_LOG_ENTRY)
    ).toEqual(TEST_ACTIVITY_LOG_ENTRY);
  });

  test("new txma event and existing activity log entry", () => {
    const activityLogEntry: ActivityLogEntry = formatIntoActivitLogEntry(
      TEST_USER_ACTIVITY_SECOND_TXMA_EVENT
    );
    expect(activityLogEntry).toEqual(
      TEST_ACTIVITY_LOG_ENTRY_WITH_TWO_ACTIVITIES
    );
    expect(activityLogEntry.activities[1].type).toEqual(secondEventType);
  });
  test("new txma event and 100 existing acitivities", () => {
    for (let i = 0; i < 99; i += 1) {
      TEST_USER_ACTIVITY_SECOND_TXMA_EVENT.activityLogEntry?.activities.push(
        activity
      );
    }
    expect(
      formatIntoActivitLogEntry(TEST_USER_ACTIVITY_SECOND_TXMA_EVENT).truncated
    ).toEqual(true);
  });
});

describe("validatUserActivityLog", () => {
  test("throws error when txmaEvent is missing", () => {
    const userActivityLog = JSON.parse(JSON.stringify(JSON.stringify({})));
    expect(() => {
      validateUserActivityLog(userActivityLog);
    }).toThrowError();
  });

  test("doesn't throw an error with valid data", () => {
    expect(
      validateUserActivityLog(TEST_USER_ACTIVITY_LOG_UNDEFINED_LOG_ENTRY)
    ).toBe(undefined);
  });
});

describe("validateTxmaEventBody", () => {
  test("doesn't throw an error with valid txma data", () => {
    expect(
      validateTxmaEventBody(
        TEST_USER_ACTIVITY_LOG_UNDEFINED_LOG_ENTRY.txmaEvent
      )
    ).toBe(undefined);
  });

  test("throws error when client_id is missing", () => {
    const invalidTxmaEvent = {
      ...TEST_USER_ACTIVITY_LOG_UNDEFINED_LOG_ENTRY.txmaEvent,
      client_id: undefined,
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrowError();
  });

  test("throws error when timestamp is missing", () => {
    const invalidTxmaEvent = {
      ...TEST_USER_ACTIVITY_LOG_UNDEFINED_LOG_ENTRY.txmaEvent,
      timestamp: undefined,
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrowError();
  });

  test("throws error when event name is missing", () => {
    const invalidTxmaEvent = {
      ...TEST_USER_ACTIVITY_LOG_UNDEFINED_LOG_ENTRY.txmaEvent,
      event_name: undefined,
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrowError();
  });

  test(" throws error when user is missing", () => {
    const invalidTxmaEvent = {
      ...TEST_USER_ACTIVITY_LOG_UNDEFINED_LOG_ENTRY.txmaEvent,
      user: undefined,
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrowError();
  });

  test("throws error when user_id  is missing", () => {
    const invalidTxmaEvent = {
      ...TEST_USER_ACTIVITY_LOG_UNDEFINED_LOG_ENTRY.txmaEvent,
      user: { session_id: sessionId },
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrowError();
  });

  test("throws error when session_id  is missing", () => {
    const invalidTxmaEvent = {
      ...TEST_USER_ACTIVITY_LOG_UNDEFINED_LOG_ENTRY.txmaEvent,
      user: { user_id: userId },
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrowError();
  });
});

describe("validateUser", () => {
  test("throws error when user is is missing", () => {
    const inValidUser = JSON.parse(JSON.stringify({}));
    expect(() => {
      validateUser(inValidUser);
    }).toThrowError();
  });
});

describe("sendSqsMessage", () => {
  beforeEach(() => {
    sqsMock.reset();
    process.env.QUEUE_URL = queueUrl;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("Send the SQS event on the queue", async () => {
    sqsMock.on(SendMessageCommand).resolves({ MessageId: messageId });
    expect(
      await sendSqsMessage(
        JSON.stringify(TEST_USER_ACTIVITY_LOG_UNDEFINED_LOG_ENTRY),
        queueUrl
      )
    ).toEqual(messageId);
    expect(
      sqsMock.commandCalls(SendMessageCommand, {
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(Object),
      })
    );
  });
});
