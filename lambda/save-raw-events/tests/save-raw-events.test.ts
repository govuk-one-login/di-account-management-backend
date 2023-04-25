import "aws-sdk-client-mock-jest";
import crypto from "crypto";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";

import {
  handler,
  validateTxmaEventBody,
  writeRawTxmaEvent,
  validateUser,
} from "../save-raw-events";
import { TEST_SQS_EVENT, makeTxmaEvent } from "./test-helpers";

const dynamoMock = mockClient(DynamoDBDocumentClient);
const sqsMock = mockClient(SQSClient);

const TABLE_NAME = "TABLE_NAME";
const UUID = "12345";
const TIMESTAMP = 1668505677;

describe("writeRawTxmaEvent", () => {
  beforeEach(() => {
    dynamoMock.reset();
    process.env.TABLE_NAME = TABLE_NAME;
    jest.spyOn(Date, "now").mockImplementation(() => TIMESTAMP);
    jest.spyOn(crypto, "randomUUID").mockImplementation(() => UUID);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, "now").mockRestore();
    jest.spyOn(crypto, "randomUUID").mockRestore();
  });

  test("writes raw events to DynamoDB", async () => {
    await writeRawTxmaEvent(makeTxmaEvent());
    expect(dynamoMock.commandCalls(PutCommand).length).toEqual(1);
    expect(dynamoMock).toHaveReceivedCommandWith(PutCommand, {
      TableName: process.env.TABLE_NAME,
      Item: {
        id: UUID,
        timestamp: TIMESTAMP,
        event: makeTxmaEvent(),
        remove_at: 9444506,
      },
    });
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

describe("validateTxmaEventBody", () => {
  test("doesn't throw an error with valid txma data", () => {
    expect(validateTxmaEventBody(makeTxmaEvent())).toBe(undefined);
  });

  test("throws error when client_id is missing", () => {
    const invalidTxmaEvent = {
      ...makeTxmaEvent(),
      clientId: undefined,
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrowError();
  });

  test("throws error when timestamp is missing", () => {
    const invalidTxmaEvent = {
      ...makeTxmaEvent(),
      timestamp: undefined,
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrowError();
  });
  test("throws error when event name is missing", () => {
    const invalidTxmaEvent = {
      ...makeTxmaEvent(),
      event_name: undefined,
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrowError();
  });

  test(" throws error when user is missing", () => {
    const invalidTxmaEvent = {
      ...makeTxmaEvent(),
      user: undefined,
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrowError();
  });

  test("throws error when user_id is missing", () => {
    const invalidTxmaEvent = {
      ...makeTxmaEvent(),
      user: {},
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrowError();
  });
});

describe("handler", () => {
  beforeEach(() => {
    dynamoMock.reset();
    sqsMock.reset();
    process.env.TABLE_NAME = "TABLE_NAME";
    jest.spyOn(Date, "now").mockImplementation(() => TIMESTAMP);
    jest.spyOn(crypto, "randomUUID").mockImplementation(() => UUID);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, "now").mockRestore();
    jest.spyOn(crypto, "randomUUID").mockRestore();
  });

  test("Adds raw event to the table", async () => {
    await handler(TEST_SQS_EVENT);
    expect(dynamoMock.commandCalls(PutCommand).length).toEqual(1);
    expect(dynamoMock).toHaveReceivedCommandWith(PutCommand, {
      TableName: process.env.TABLE_NAME,
      Item: {
        id: UUID,
        timestamp: TIMESTAMP,
        event: makeTxmaEvent(),
        remove_at: 9444506,
      },
    });
  });
});

describe("handler error handling", () => {
  let consoleErrorMock: jest.SpyInstance;

  beforeEach(() => {
    dynamoMock.reset();
    sqsMock.reset();
    process.env.TABLE_NAME = "TABLE_NAME";
    process.env.DLQ_URL = "DLQ_URL";
    consoleErrorMock = jest.spyOn(global.console, "error").mockImplementation();
    dynamoMock.rejectsOnce("mock error");
  });

  afterEach(() => {
    consoleErrorMock.mockRestore();
    jest.clearAllMocks();
  });

  test("logs the error message", async () => {
    await handler(TEST_SQS_EVENT);
    expect(consoleErrorMock).toHaveBeenCalledTimes(1);
  });

  test("sends the event to the dead letter queue", async () => {
    await handler(TEST_SQS_EVENT);
    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(1);
    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl: "DLQ_URL",
      MessageBody: JSON.stringify(makeTxmaEvent()),
    });
  });
});
