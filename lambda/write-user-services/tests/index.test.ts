import { lambdaHandler, writeUserServices, parseRecordBody } from "../index";
import { UserServices } from "../models";

import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SQSEvent, SQSRecord } from "aws-lambda";

const TEST_USER_SERVICES: UserServices = {
  user_id: "user-id",
  services: [
    {
      client_id: "client_id",
      last_accessed: new Date(),
      count_successful_logins: 1,
    },
  ],
};

const TEST_SQS_RECORD: SQSRecord = {
  messageId: "19dd0b57-b21e-4ac1-bd88-01bbb068cb78",
  receiptHandle: "MessageReceiptHandle",
  body: JSON.stringify(TEST_USER_SERVICES),
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

const TEST_SQS_EVENT: SQSEvent = {
  Records: [TEST_SQS_RECORD, TEST_SQS_RECORD],
};

const dynamoMock = mockClient(DynamoDBDocumentClient);

describe("writeUserServices", () => {
  beforeEach(() => {
    dynamoMock.reset();

    process.env.TABLE_NAME = "TABLE_NAME";
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("writes to DynamoDB", async () => {
    await writeUserServices(TEST_USER_SERVICES);
    expect(dynamoMock.commandCalls(PutCommand).length).toEqual(1);
  });
});

describe("parseRecordBody", () => {
  test("parses the event body", () => {
    expect(parseRecordBody(JSON.stringify(TEST_SQS_RECORD))).toStrictEqual(
      TEST_SQS_RECORD
    );
  });
});

describe("lambdaHandler", () => {
  beforeEach(() => {
    dynamoMock.reset();

    process.env.TABLE_NAME = "TABLE_NAME";
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("it iterates over each record in the batch", async () => {
    await lambdaHandler(TEST_SQS_EVENT);
    expect(dynamoMock.commandCalls(PutCommand).length).toEqual(2);
  });

  describe("error handling", () => {
    test("logs the error message", async () => {
      dynamoMock.rejectsOnce("mock error");
      const consoleErrorMock = jest
        .spyOn(global.console, "error")
        .mockImplementation();

      await lambdaHandler(TEST_SQS_EVENT);

      expect(consoleErrorMock).toHaveBeenCalledTimes(1);
      consoleErrorMock.mockRestore();
    });
  });
});
