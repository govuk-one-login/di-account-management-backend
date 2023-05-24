import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { mockClient } from "aws-sdk-client-mock";
import { 
    validateActivityLogEntry,
    writeActivityLogEntry,
    handler
} from "../write-activity-log"
import { 
    ACTIVITY_LOG_ENTRY_NO_TIMESTAMP,
    ACTIVITY_LOG_ENTRY_NO_USER_ID,
    TEST_ACTIVITY_LOG_ENTRY,
    ACTIVITY_LOG_ENTRY_NO_ACTIVITY_ARRAY,
    TEST_SQS_EVENT
} from "./test-helpers";

const dynamoMock = mockClient(DynamoDBDocumentClient);
const sqsMock = mockClient(SQSClient);

describe("ValidateActivityLogEntries", () => {

    test("doens't throw error with valid data", () => {
        expect(validateActivityLogEntry(TEST_ACTIVITY_LOG_ENTRY))
    });

    test("doens't throw error when activities in array", () => {
        expect(validateActivityLogEntry(TEST_ACTIVITY_LOG_ENTRY))
    });

    test("doens't throw error when activities array is absent", () => {
        expect(validateActivityLogEntry(ACTIVITY_LOG_ENTRY_NO_ACTIVITY_ARRAY))
    });

    test("throws an error when user_id is missing", () => {
        expect(() => {
            validateActivityLogEntry(ACTIVITY_LOG_ENTRY_NO_USER_ID)
        })
            .toThrowError(
            new Error(`Could not validate activity log entry ${JSON.stringify(ACTIVITY_LOG_ENTRY_NO_USER_ID)}`)
        )
    });

    test("throws an error when timestamp is missing", () => {
        expect(() => {
            validateActivityLogEntry(ACTIVITY_LOG_ENTRY_NO_TIMESTAMP)
        })
            .toThrowError(
            new Error(`Could not validate activity log entry ${JSON.stringify(ACTIVITY_LOG_ENTRY_NO_TIMESTAMP)}`)
        )
    })
})

describe("writeActivitwriteActivityLogEntryyLog", () => {
    beforeEach(() => {
      dynamoMock.reset();
    });
  
    afterEach(() => {
      jest.clearAllMocks();
    });
  
    test("writes to DynamoDB", async () => {
      await writeActivityLogEntry(TEST_ACTIVITY_LOG_ENTRY);
      expect(dynamoMock.commandCalls(PutCommand).length).toEqual(1);
    });
});

describe("lambdaHandler", () => {
    beforeEach(() => {
      dynamoMock.reset();
      sqsMock.reset();
      //process.env.TABLE_NAME = tableName;
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