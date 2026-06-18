import { vi, describe, test, expect, beforeEach, afterEach } from "vitest";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import {
  handler,
  validateUserData,
  deleteUserData,
} from "../delete-inactive-account-tracker.js";

import {
  TEST_SNS_EVENT_WITH_TWO_RECORDS,
  TEST_USER_DATA,
} from "./testFixtures.js";
import { Context } from "aws-lambda";

const dynamoMock = mockClient(DynamoDBDocumentClient);

describe("deleteUserData", () => {
  beforeEach(() => {
    dynamoMock.reset();
    process.env.TABLE_NAME = "TABLE_NAME";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("queries the GSI and deletes matching records", async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [
        { dateForDeletion: "2030-01-01", commonSubjectId: "user-id" },
      ],
    });

    await deleteUserData(TEST_USER_DATA);

    expect(dynamoMock).toHaveReceivedCommandWith(QueryCommand, {
      TableName: "TABLE_NAME",
      IndexName: "CommonSubjectIdIndex",
      KeyConditionExpression: "commonSubjectId = :uid",
      ExpressionAttributeValues: { ":uid": TEST_USER_DATA.user_id },
    });
    expect(dynamoMock).toHaveReceivedCommandWith(DeleteCommand, {
      TableName: "TABLE_NAME",
      Key: { dateForDeletion: "2030-01-01", commonSubjectId: "user-id" },
    });
  });

  test("does not delete when no records found", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [] });

    await deleteUserData(TEST_USER_DATA);

    expect(dynamoMock.commandCalls(DeleteCommand).length).toEqual(0);
  });

  test("deletes multiple records when query returns many", async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [
        { dateForDeletion: "2030-01-01", commonSubjectId: "user-id" },
        { dateForDeletion: "2031-01-01", commonSubjectId: "user-id" },
      ],
    });

    await deleteUserData(TEST_USER_DATA);

    expect(dynamoMock.commandCalls(DeleteCommand).length).toEqual(2);
  });
});

describe("handler", () => {
  beforeEach(() => {
    dynamoMock.reset();
    process.env.TABLE_NAME = "TABLE_NAME";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("it iterates over each record in the batch", async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [
        { dateForDeletion: "2030-01-01", commonSubjectId: "user-id" },
      ],
    });

    await handler(TEST_SNS_EVENT_WITH_TWO_RECORDS, {} as Context);
    expect(dynamoMock.commandCalls(DeleteCommand).length).toEqual(2);
  });

  describe("error handling", () => {
    beforeEach(() => {
      dynamoMock.on(QueryCommand).rejects("mock error");
    });

    test("throws error with message ID", async () => {
      let errorMessage;
      try {
        await handler(TEST_SNS_EVENT_WITH_TWO_RECORDS, {} as Context);
      } catch (error) {
        errorMessage = (error as Error).message;
      }
      expect(errorMessage).toContain(
        "Unable to delete inactive account tracker data for message with ID: MessageId, mock error"
      );
    });
  });
});

describe("validateUserData", () => {
  test("doesn't throw an error with valid data", () => {
    expect(validateUserData(TEST_USER_DATA)).toBe(TEST_USER_DATA);
  });

  test("throws an error when user_id is missing", () => {
    const userData = JSON.parse(JSON.stringify({ foo: "bar" }));
    expect(() => {
      validateUserData(userData);
    }).toThrow();
  });
});
