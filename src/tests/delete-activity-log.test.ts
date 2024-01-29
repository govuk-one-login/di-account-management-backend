import "aws-sdk-client-mock-jest";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { mockClient } from "aws-sdk-client-mock";
import { BatchWriteItemCommand } from "@aws-sdk/client-dynamodb";
import {
  batchDeleteActivityLog,
  buildBatchDeletionRequestArray,
  getAllActivitiesoForUser,
  handler,
  validateUserData,
} from "../delete-activity-log";
import {
  Activity,
  ActivityLogEntry,
} from "../common/delete-activity-log-models";
import type { SNSEvent, SNSMessage, SNSEventRecord } from "aws-lambda";

const dynamoMock = mockClient(DynamoDBDocumentClient);
const sqsMock = mockClient(SQSClient);

export const eventType = "AUTH_AUTH_CODE_ISSUED";
export const randomEventType = "AUTH_OTHER_RANDOM_EVENT";
export const userId = "user_id";
export const sessionId = "session_id";
export const clientId = "client_id";
export const date = new Date();
export const tableName = "TableName";
export const timestamp = date.valueOf();

const activityList: Activity[] = [
  {
    type: "service_visited",
    client_id: clientId,
    timestamp,
  },
];

const activityLogEntry: ActivityLogEntry = {
  event_type: eventType,
  session_id: sessionId,
  user_id: userId,
  timestamp,
  activities: activityList,
  truncated: true,
};
const activityLogEntry1: ActivityLogEntry = {
  ...activityLogEntry,
  session_id: "session1",
};
const activityLogEntry2: ActivityLogEntry = {
  ...activityLogEntry,
};
const activityLogEntry3: ActivityLogEntry = {
  ...activityLogEntry,
  session_id: "session3",
};
const activityLogEntry4: ActivityLogEntry = {
  ...activityLogEntry,
  session_id: "session4",
};
const deleteRequest = {
  DeleteRequest: {
    Key: {
      user_id: { S: userId },
      timestamp: { N: timestamp.toString() },
    },
  },
};

// From test--helpers
export const TEST_USER_DATA = {
  user_id: "user-id",
};

const TEST_SNS_MESSAGE: SNSMessage = {
  SignatureVersion: "SignatureVersion",
  Timestamp: "Timestamp",
  Signature: "Signature",
  SigningCertUrl: "SigningCertUrl",
  MessageId: "MessageId",
  Message: JSON.stringify(TEST_USER_DATA),
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

export const TEST_SNS_EVENT_WITH_TWO_RECORDS: SNSEvent = {
  Records: [TEST_SNS_EVENT_RECORD, TEST_SNS_EVENT_RECORD],
};

describe("deleteUserData", () => {
  beforeEach(() => {
    dynamoMock.reset();
    process.env.TABLE_NAME = "TABLE_NAME";
    // The mock will return activityLogEntry1 & 2 for the first set of requests
    // and further requests will return activityLogEntry3 & 4
    dynamoMock
      .on(QueryCommand)
      .resolvesOnce({
        Items: [activityLogEntry1, activityLogEntry2],
        LastEvaluatedKey: activityLogEntry2,
      })
      .resolves({
        Items: [activityLogEntry3, activityLogEntry4],
        LastEvaluatedKey: undefined,
      });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("multiple requests made to DB to get all request", async () => {
    const activityRecords: ActivityLogEntry[] | undefined =
      await getAllActivitiesoForUser({ user_id: userId });
    expect(activityRecords?.[0]).toEqual(activityLogEntry1);
    expect(activityRecords?.[1]).toEqual(activityLogEntry2);
    expect(activityRecords?.[2]).toEqual(activityLogEntry3);
    expect(activityRecords?.[3]).toEqual(activityLogEntry4);
  });

  test("map an activity to a deletion request structure", () => {
    const batchDeletePayload = buildBatchDeletionRequestArray([
      activityLogEntry,
      activityLogEntry,
    ]);
    expect(batchDeletePayload[0]).toEqual([deleteRequest, deleteRequest]);
  });

  test("split 56 activities into 3 arrays with max 25 items", () => {
    const arrayOf56Activities: ActivityLogEntry[] =
      Array(56).fill(activityLogEntry);
    const batchDeletePayload =
      buildBatchDeletionRequestArray(arrayOf56Activities);
    expect(batchDeletePayload).toHaveLength(3);
    expect(batchDeletePayload[0]).toHaveLength(25);
    expect(batchDeletePayload[1]).toHaveLength(25);
    expect(batchDeletePayload[2]).toHaveLength(6);
    expect(batchDeletePayload[0][0]).toEqual(deleteRequest);
  });

  test("test batch deletion request when 65 items to delete", () => {
    const arrayOf56Activities: ActivityLogEntry[] =
      Array(56).fill(activityLogEntry);
    batchDeleteActivityLog(arrayOf56Activities);
    expect(dynamoMock.commandCalls(BatchWriteItemCommand).length).toEqual(3);
  });
});

describe("handler", () => {
  describe("when db contains activity log records", () => {
    beforeEach(() => {
      dynamoMock.reset();
      sqsMock.reset();
      process.env.TABLE_NAME = "TABLE_NAME";
      dynamoMock.on(QueryCommand).resolves({ Items: [activityLogEntry] });
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    test("it iterates over each record in the batch", async () => {
      await handler(TEST_SNS_EVENT_WITH_TWO_RECORDS);
      expect(dynamoMock.commandCalls(BatchWriteItemCommand).length).toEqual(2);
      expect(dynamoMock.commandCalls(QueryCommand).length).toEqual(2);
    });
  });

  describe("when db contains no activity log records", () => {
    beforeEach(() => {
      dynamoMock.reset();
      sqsMock.reset();
      process.env.TABLE_NAME = "TABLE_NAME";
      dynamoMock.on(QueryCommand).resolves({ Items: [] });
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    test("no delete requests", async () => {
      await handler(TEST_SNS_EVENT_WITH_TWO_RECORDS);
      expect(dynamoMock.commandCalls(BatchWriteItemCommand).length).toEqual(0);
    });
  });

  describe("error handling", () => {
    let consoleErrorMock: jest.SpyInstance;

    beforeEach(() => {
      sqsMock.reset();
      consoleErrorMock = jest
        .spyOn(global.console, "error")
        .mockImplementation();
      sqsMock.on(SendMessageCommand).resolves({ MessageId: "MessageId" });
      dynamoMock.reset();
      dynamoMock.rejectsOnce("mock error");
    });

    afterEach(() => {
      consoleErrorMock.mockRestore();
    });

    test("logs the error message", async () => {
      await handler(TEST_SNS_EVENT_WITH_TWO_RECORDS);
      expect(consoleErrorMock).toHaveBeenCalledTimes(2);
    });

    test("sends the event to the dead letter queue", async () => {
      await handler(TEST_SNS_EVENT_WITH_TWO_RECORDS);
      expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(2);
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
