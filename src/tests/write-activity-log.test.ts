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
  TEST_ENCRYPTED_ACTIVITY_LOG_ENTRY,
  TEST_SQS_EVENT,
} from "./testFixtures";

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
    }).toThrowError(
      new Error(
        `Activity log entry validation failed for event_id: ab12345a-a12b-3ced-ef12-12a3b4cd5678`
      )
    );
  });

  test("throws an error when timestamp is missing", () => {
    expect(() => {
      validateActivityLogEntry(ACTIVITY_LOG_ENTRY_NO_TIMESTAMP);
    }).toThrowError(
      new Error(
        `Activity log entry validation failed for event_id: ab12345a-a12b-3ced-ef12-12a3b4cd5678`
      )
    );
  });
});

describe("writeActivityLogEntry", () => {
  beforeEach(() => {
    dynamoMock.reset();
    process.env.TABLE_NAME = "tableName";
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
    process.env.TABLE_NAME = "TABLE_NAME";
    process.env.AWS_REGION = "AWS_REGION";
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("it iterates over each record in the batch", async () => {
    await handler(TEST_SQS_EVENT);
    expect(dynamoMock.commandCalls(PutCommand).length).toEqual(2);
  });

  describe("error handling", () => {
    beforeEach(() => {
      sqsMock.reset();
      sqsMock.on(SendMessageCommand).resolves({ MessageId: "MessageId" });
      process.env.TABLE_NAME = "TABLE_NAME";
      process.env.AWS_REGION = "AWS_REGION";
      dynamoMock.rejectsOnce("mock error");
    });

    test("logs the error message", async () => {
      let errorMessage;
      try {
        await handler(TEST_SQS_EVENT);
      } catch (error) {
        errorMessage = (error as Error).message;
      }
      expect(errorMessage).toContain(
        "Unable to write activity log for message with ID: 19dd0b57-b21e-4ac1-bd88-01bbb068cb78, mock error"
      );
    });
  });
});
