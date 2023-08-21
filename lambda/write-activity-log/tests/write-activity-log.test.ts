import "aws-sdk-client-mock-jest";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { mockClient } from "aws-sdk-client-mock";
import {
  validateActivityLogEntry,
  writeActivityLogEntry,
  handler,
} from "../write-activity-log";
import {
  ACTIVITY_LOG_ENTRY_NO_TIMESTAMP,
  ACTIVITY_LOG_ENTRY_NO_USER_ID,
  TEST_ACTIVITY_LOG_ENTRY,
  ACTIVITY_LOG_ENTRY_NO_ACTIVITY_ARRAY,
  TEST_SQS_EVENT,
  TEST_ACTIVITY_LOG_WITH_ACTIVITY_TYPE_UNDEFINED,
  TEST_ENCRYPTED_ACTIVITY_LOG_ENTRY,
} from "./test-helpers";

jest.mock(`../encrypt-data`, () => ({
  encryptData: jest.fn().mockReturnValue(`an-encrypted-activity-array`),
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

  test("throws error when activities array is absent", () => {
    expect(() => {
      validateActivityLogEntry(ACTIVITY_LOG_ENTRY_NO_ACTIVITY_ARRAY);
    }).toThrowError(new Error(`Could not validate activity log entry`));
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

  test("throws an error when an activity has type missing", () => {
    expect(() => {
      validateActivityLogEntry(TEST_ACTIVITY_LOG_WITH_ACTIVITY_TYPE_UNDEFINED);
    }).toThrowError(new Error(`Could not validate activity log entry`));
  });
});

describe("writeActivitwriteActivityLogEntryyLog", () => {
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
