import dotenv from "dotenv";
dotenv.config({ path: ".env.test" });
import "aws-sdk-client-mock-jest";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { mockClient } from "aws-sdk-client-mock";
import {
  handler,
  validateUserData,
  deleteUserData,
} from "../delete-user-services";

import {
  TEST_SNS_EVENT_WITH_TWO_RECORDS,
  TEST_USER_DATA,
} from "./testFixtures";

const dynamoMock = mockClient(DynamoDBDocumentClient);
const sqsMock = mockClient(SQSClient);

describe("deleteUserData", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    dynamoMock.reset();
  });

  afterEach(() => {
    process.env = OLD_ENV;
    jest.clearAllMocks();
  });

  test("deletes item from DynamoDB", async () => {
    await deleteUserData(TEST_USER_DATA);
    expect(dynamoMock).toHaveReceivedCommandWith(DeleteCommand, {
      TableName: process.env.TABLE_NAME,
      Key: { user_id: TEST_USER_DATA.user_id },
    });
  });
});

describe("handler", () => {
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
    await handler(TEST_SNS_EVENT_WITH_TWO_RECORDS);
    expect(dynamoMock.commandCalls(DeleteCommand).length).toEqual(2);
  });

  describe("error handling", () => {
    beforeEach(() => {
      sqsMock.reset();
      sqsMock.on(SendMessageCommand).resolves({ MessageId: "MessageId" });
      dynamoMock.rejectsOnce("mock error");
    });

    test("logs the error message", async () => {
      let errorMessage;
      try {
        await handler(TEST_SNS_EVENT_WITH_TWO_RECORDS);
      } catch (error) {
        errorMessage = (error as Error).message;
      }
      expect(errorMessage).toContain(
        "Unable to delete user services for message with ID: MessageId, mock error"
      );
    });
  });
});

describe("validateUserData", () => {
  test("doesn't throw an error with valid data", () => {
    expect(validateUserData(TEST_USER_DATA)).toBe(TEST_USER_DATA);
  });

  describe("throws an error", () => {
    test("when user_id is missing", () => {
      const userData = JSON.parse(
        JSON.stringify({
          foo: "bar",
        })
      );
      expect(() => {
        validateUserData(userData);
      }).toThrow();
    });
  });
});
