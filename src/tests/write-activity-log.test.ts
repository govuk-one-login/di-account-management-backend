import "aws-sdk-client-mock-jest";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { mockClient } from "aws-sdk-client-mock";
import {
  validateActivityLogEntry,
  writeActivityLogEntry,
  handler,
} from "../write-activity-log";
import { SQSEvent, SQSRecord } from "aws-lambda";
import { ActivityLogEntry, EncryptedActivityLogEntry } from "../common/model";

export const eventId = "event_id";
export const eventType = "TXMA_EVENT";
export const sessionId = "123456789";
export const userId = "qwerty";
export const timestamp = 123456789;
export const clientId = "client-id-value";
export const reportedSuspicious = true;

export const TEST_ACTIVITY_LOG_ENTRY: ActivityLogEntry = {
  event_type: eventType,
  session_id: sessionId,
  user_id: userId,
  timestamp,
  event_id: eventId,
  client_id: clientId,
  reported_suspicious: reportedSuspicious,
};

const NO_ACTIVITY_ARRAY = { ...TEST_ACTIVITY_LOG_ENTRY, activities: undefined };
export const ACTIVITY_LOG_ENTRY_NO_ACTIVITY_ARRAY: ActivityLogEntry =
  JSON.parse(JSON.stringify(NO_ACTIVITY_ARRAY));

const NO_USER_ID = { ...TEST_ACTIVITY_LOG_ENTRY, user_id: undefined };
export const ACTIVITY_LOG_ENTRY_NO_USER_ID: ActivityLogEntry = JSON.parse(
  JSON.stringify(NO_USER_ID)
);

const NO_TIMESTAMP = { ...TEST_ACTIVITY_LOG_ENTRY, timestamp: undefined };
export const ACTIVITY_LOG_ENTRY_NO_TIMESTAMP: ActivityLogEntry = JSON.parse(
  JSON.stringify(NO_TIMESTAMP)
);

export const TEST_ACTIVITY_LOG_WITH_ACTIVITY_TYPE_UNDEFINED = {
  ...TEST_ACTIVITY_LOG_ENTRY,
};

const TEST_SQS_RECORD: SQSRecord = {
  messageId: "19dd0b57-b21e-4ac1-bd88-01bbb068cb78",
  receiptHandle: "MessageReceiptHandle",
  body: JSON.stringify(TEST_ACTIVITY_LOG_ENTRY),
  attributes: {
    ApproximateReceiveCount: "1",
    SentTimestamp: "1523232000000",
    SenderId: "123456789012",
    ApproximateFirstReceiveTimestamp: "1523232000001",
  },
  messageAttributes: {},
  md5OfBody: "7b270e59b47ff90a553787216d55d91d",
  eventSource: "aws:sqs",
  eventSourceARN: "arn:aws:sqs:us-east-1:123456789012:MyQueue",
  awsRegion: "us-east-1",
};

export const TEST_SQS_EVENT: SQSEvent = {
  Records: [TEST_SQS_RECORD, TEST_SQS_RECORD],
};

export const TEST_ENCRYPTED_ACTIVITY_LOG_ENTRY: EncryptedActivityLogEntry = {
  event_type: eventType,
  session_id: sessionId,
  user_id: userId,
  timestamp,
  client_id: clientId,
  event_id: eventId,
  reported_suspicious: reportedSuspicious,
};

jest.mock(`../common/encrypt-data`, () => ({
  __esModule: true,
  default: jest.fn(() => ({
    return: "an-encrypted-activity-array",
  })),
}));

const dynamoMock = mockClient(DynamoDBDocumentClient);
const sqsMock = mockClient(SQSClient);

describe("ValidateActivityLogEntries", () => {
  test("doens't throw error with valid data", () => {
    expect(validateActivityLogEntry(TEST_ACTIVITY_LOG_ENTRY));
  });

  test("doens't throw error when activities in array", () => {
    expect(validateActivityLogEntry(TEST_ACTIVITY_LOG_ENTRY));
  });

  test("throws an error when user_id is missing", () => {
    expect(() => {
      validateActivityLogEntry(ACTIVITY_LOG_ENTRY_NO_USER_ID);
    }).toThrowError(new Error(`Could not validate activity log entry`));
  });

  test("throws an error when timestamp is missing", () => {
    expect(() => {
      validateActivityLogEntry(ACTIVITY_LOG_ENTRY_NO_TIMESTAMP);
    }).toThrowError(new Error(`Could not validate activity log entry`));
  });
});

describe("writeActivityLogEntry", () => {
  beforeEach(() => {
    dynamoMock.reset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("writes to DynamoDB", async () => {
    await writeActivityLogEntry(TEST_ENCRYPTED_ACTIVITY_LOG_ENTRY);
    expect(dynamoMock.commandCalls(PutCommand).length).toEqual(1);
    expect(dynamoMock).toHaveReceivedCommandWith(PutCommand, {
      TableName: process.env.TABLE_NAME,
      Item: TEST_ENCRYPTED_ACTIVITY_LOG_ENTRY,
    });
  });
});

describe("lambdaHandler", () => {
  beforeEach(() => {
    dynamoMock.reset();
    sqsMock.reset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("it iterates over each record in the batch", async () => {
    await handler(TEST_SQS_EVENT);
    expect(dynamoMock.commandCalls(PutCommand).length).toEqual(2);
  });

  describe("error handling", () => {
    let consoleErrorMock: jest.SpyInstance;

    beforeEach(() => {
      sqsMock.reset();
      sqsMock.on(SendMessageCommand).resolves({ MessageId: "MessageId" });
      consoleErrorMock = jest
        .spyOn(global.console, "error")
        .mockImplementation();

      dynamoMock.rejectsOnce("mock error");
    });

    afterEach(() => {
      consoleErrorMock.mockRestore();
    });

    test("logs the error message", async () => {
      await handler(TEST_SQS_EVENT);
      expect(consoleErrorMock).toHaveBeenCalledTimes(1);
    });

    test("sends the event to the dead letter queue", async () => {
      await handler(TEST_SQS_EVENT);
      expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(1);
    });
  });
});
