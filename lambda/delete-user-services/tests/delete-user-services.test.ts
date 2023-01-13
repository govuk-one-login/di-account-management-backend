import "aws-sdk-client-mock-jest";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { mockClient } from "aws-sdk-client-mock";
import {
  handler,
  validateUserData,
  deleteUserData,
} from "../delete-user-services";

import { TEST_USER_DATA, TEST_SNS_EVENT } from "./test-helpers";

const dynamoMock = mockClient(DynamoDBDocumentClient);
const sqsMock = mockClient(SQSClient);

describe("deleteUserData", () => {
  beforeEach(() => {
    dynamoMock.reset();

    process.env.TABLE_NAME = "TABLE_NAME";
  });

  afterEach(() => {
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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("it iterates over each record in the batch", async () => {
    await handler(TEST_SNS_EVENT);
    expect(dynamoMock.commandCalls(DeleteCommand).length).toEqual(2);
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
      await handler(TEST_SNS_EVENT);
      expect(consoleErrorMock).toHaveBeenCalledTimes(1);
    });

    test("sends the event to the dead letter queue", async () => {
      await handler(TEST_SNS_EVENT);
      expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(1);
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
      }).toThrowError();
    });
  });
});
