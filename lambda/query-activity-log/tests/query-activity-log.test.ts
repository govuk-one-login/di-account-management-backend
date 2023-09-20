import "aws-sdk-client-mock-jest";
import { mockClient } from "aws-sdk-client-mock";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

import { decryptData } from "../decrypt-data";

import {
  decryptActivityLog,
  handler,
  queryActivityLog,
  sendSqsMessage,
  validateTxmaEventBody,
  validateUser,
} from "../query-activity-log";
import {
  MUCKY_DYNAMODB_STREAM_EVENT,
  TEST_ACTIVITY_LOG_ENTRY,
  TEST_DYNAMO_STREAM_EVENT,
  TEST_ENCRYPTED_ACTIVITY_LOG_ENTRY,
  TEST_TXMA_EVENT,
  messageId,
  queueUrl,
  randomEventType,
  sessionId,
  tableName,
  userId,
} from "./test-helpers";
import { UserActivityLog } from "../models";

const dynamoMock = mockClient(DynamoDBDocumentClient);
const sqsMock = mockClient(SQSClient);

jest.mock("../decrypt-data", () => ({
  decryptData: jest.fn(async (data: string) => {
    return data;
  }),
}));

const userActivityLog: UserActivityLog = {
  txmaEvent: TEST_TXMA_EVENT,
  activityLogEntry: TEST_ACTIVITY_LOG_ENTRY,
};

describe("queryActivityLog", () => {
  beforeEach(() => {
    dynamoMock.reset();

    process.env.TABLE_NAME = tableName;

    dynamoMock
      .on(QueryCommand)
      .resolves({ Items: [TEST_ENCRYPTED_ACTIVITY_LOG_ENTRY] });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("Query activity log", async () => {
    const activityLog = await queryActivityLog(userId, sessionId);
    expect(activityLog).not.toBeNull();
    expect(activityLog).toEqual(TEST_ENCRYPTED_ACTIVITY_LOG_ENTRY);
  });

  test("Query user service empty list", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: undefined });
    const activityLog = await queryActivityLog(userId, sessionId);
    expect(activityLog).not.toBeNull();
    expect(activityLog).toBeUndefined();
  });
});

describe("validateTxmaEventBody", () => {
  test("doesn't throw an error with valid txma data", () => {
    expect(validateTxmaEventBody(TEST_TXMA_EVENT)).toBe(undefined);
  });

  test("throws error when client_id is missing", () => {
    const invalidTxmaEvent = {
      ...TEST_TXMA_EVENT,
      client_id: undefined,
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrowError();
  });

  test("throws error when timestamp is missing", () => {
    const invalidTxmaEvent = {
      ...TEST_TXMA_EVENT,
      timestamp: undefined,
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrowError();
  });

  test("throws error when event name is missing", () => {
    const invalidTxmaEvent = {
      ...TEST_TXMA_EVENT,
      event_name: undefined,
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrowError();
  });

  test(" throws error when user is missing", () => {
    const invalidTxmaEvent = {
      ...TEST_TXMA_EVENT,
      user: undefined,
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrowError();
  });

  test("throws error when user_id  is missing", () => {
    const invalidTxmaEvent = {
      ...TEST_TXMA_EVENT,
      user: { session_id: sessionId },
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrowError();
  });

  test("throws error when session_id  is missing", () => {
    const invalidTxmaEvent = {
      ...TEST_TXMA_EVENT,
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
      await sendSqsMessage(JSON.stringify(userActivityLog), queueUrl)
    ).toEqual(messageId);
    expect(
      sqsMock.commandCalls(SendMessageCommand, {
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(Object),
      })
    );
  });
});

describe("decryptActivityLog", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("returns undefined if no input provided", async () => {
    const result = await decryptActivityLog(userId);
    expect(result).toBe(undefined);
  });

  test("returns an ActivityLogEntry", async () => {
    const result = await decryptActivityLog(
      userId,
      TEST_ENCRYPTED_ACTIVITY_LOG_ENTRY
    );
    expect(result).toStrictEqual(TEST_ACTIVITY_LOG_ENTRY);
  });

  test("calls decryptData", async () => {
    await decryptActivityLog(userId, TEST_ENCRYPTED_ACTIVITY_LOG_ENTRY);
    expect(decryptData).toHaveBeenCalledTimes(1);
  });
});

describe("handler", () => {
  let consoleLogMock: jest.SpyInstance;
  beforeEach(() => {
    dynamoMock.reset();
    sqsMock.reset();
    process.env.TABLE_NAME = tableName;
    process.env.OUTPUT_QUEUE_URL = queueUrl;
    consoleLogMock = jest.spyOn(global.console, "log").mockImplementation();
    sqsMock.on(SendMessageCommand).resolves({ MessageId: messageId });
    dynamoMock
      .on(QueryCommand)
      .resolves({ Items: [TEST_ENCRYPTED_ACTIVITY_LOG_ENTRY] });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("Queries the dynamo db with user_id and session_id and send an sqs event", async () => {
    await handler(TEST_DYNAMO_STREAM_EVENT);
    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(2);
    expect(dynamoMock.commandCalls(QueryCommand).length).toEqual(2);
    expect(sqsMock).toHaveReceivedNthCommandWith(1, SendMessageCommand, {
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(userActivityLog),
    });
    expect(sqsMock).toHaveReceivedNthCommandWith(2, SendMessageCommand, {
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(userActivityLog),
    });
    expect(decryptData).toHaveBeenCalledTimes(2);
  });

  test("Ignores any Non allowed event", async () => {
    await handler(MUCKY_DYNAMODB_STREAM_EVENT);
    expect(consoleLogMock).toHaveBeenCalledTimes(1);
    expect(consoleLogMock).toHaveBeenCalledWith(
      `DB stream sent a ${randomEventType} event. Irrelevant for activity log so ignoring`
    );
  });

  describe("error handing ", () => {
    let consoleErrorMock: jest.SpyInstance;

    beforeEach(() => {
      consoleErrorMock = jest
        .spyOn(global.console, "error")
        .mockImplementation();
      dynamoMock.reset();
      sqsMock.reset();
      process.env.TABLE_NAME = tableName;
      process.env.OUTPUT_QUEUE_URL = queueUrl;
      sqsMock.on(SendMessageCommand).resolves({ MessageId: messageId });
      dynamoMock.rejectsOnce("mock error");
    });

    afterEach(() => {
      jest.clearAllMocks();
      consoleErrorMock.mockRestore();
    });

    test("logs the error message", async () => {
      await handler(TEST_DYNAMO_STREAM_EVENT);
      expect(consoleErrorMock).toHaveBeenCalledTimes(2);
    });

    test("sends the event to dead letter queue", async () => {
      await handler(TEST_DYNAMO_STREAM_EVENT);
      expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(2);
    });
  });
});
