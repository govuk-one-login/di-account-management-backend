import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SQSEvent, SQSRecord } from "aws-lambda";
import { mockClient } from "aws-sdk-client-mock";
import { TxmaEvent, UserData } from "../models";
import { validateUser } from "../save-raw-events";
import {
  handler,
  validateTxmaEventBody,
  writeRawTxmaEvent,
} from "../save-raw-events";

const dynamoMock = mockClient(DynamoDBDocumentClient);
const sqsMock = mockClient(SQSClient);

const userId = "user_id";
const user: UserData = {
  user_id: userId,
};
const TEST_TXMA_EVENT: TxmaEvent = {
  event_name: "event_1",
  timestamp: new Date().toISOString(),
  client_id: "client_id",
  component_id: "component_id",
  user,
};
const TEST_SQS_RECORD: SQSRecord = {
  messageId: "19dd0b57-b21e-4ac1-bd88-01bbb068cb78",
  receiptHandle: "MessageReceiptHandle",
  body: JSON.stringify(TEST_TXMA_EVENT),
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
  Records: [TEST_SQS_RECORD],
};

const TABLE_NAME = "TABLE_NAME";

describe("writeRawTxmaEvent", () => {
  beforeEach(() => {
    dynamoMock.reset();
    process.env.TABLE_NAME = TABLE_NAME;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
  test("writes raw events to DynamoDB", async () => {
    await writeRawTxmaEvent(TEST_TXMA_EVENT);
    expect(dynamoMock.commandCalls(PutCommand).length).toEqual(1);
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
    expect(validateTxmaEventBody(TEST_TXMA_EVENT)).toBe(undefined);
  });
  test("throws error when client_id is missing", () => {
    const txmaEvent = JSON.parse(
      JSON.stringify({
        services: [
          {
            timestamp: new Date().toISOString,
            event_name: "event_name",
            component_id: "component_id",
            user: {
              user_id: "user_id",
            },
          },
        ],
      })
    );
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrowError();
  });
  test("throws error when timestamp is missing", () => {
    const txmaEvent = JSON.parse(
      JSON.stringify({
        services: [
          {
            client_id: "client_id",
            event_name: "event_name",
            component_id: "component_id",
            user: {
              user_id: "user_id",
            },
          },
        ],
      })
    );
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrowError();
  });
  test("throws error when event name is missing", () => {
    const txmaEvent = JSON.parse(
      JSON.stringify({
        services: [
          {
            client_id: "client_id",
            timestamp: new Date().toISOString,
            component_id: "component_id",
            user: {
              user_id: "user_id",
            },
          },
        ],
      })
    );
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrowError();
  });
  test("throws error when component_id is missing", () => {
    const txmaEvent = JSON.parse(
      JSON.stringify({
        services: [
          {
            client_id: "client_id",
            timestamp: new Date().toISOString,
            event_name: "event_name",
            user: {
              user_id: "user_id",
            },
          },
        ],
      })
    );
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrowError();
  });
  test(" throws error when user is missing", () => {
    const txmaEvent = JSON.parse(
      JSON.stringify({
        services: [
          {
            client_id: "client_id",
            timestamp: new Date().toISOString,
            event_name: "event_name",
            component_id: "component_id",
          },
        ],
      })
    );
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrowError();
  });
  test("throws error when user_id  is missing", () => {
    const txmaEvent = JSON.parse(
      JSON.stringify({
        services: [
          {
            client_id: "client_id",
            timestamp: new Date().toISOString,
            event_name: "event_name",
            component_id: "component_id",
            user: {},
          },
        ],
      })
    );
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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("Adds raw event to the table", async () => {
    await handler(TEST_SQS_EVENT);
    expect(dynamoMock.commandCalls(PutCommand).length).toEqual(1);
  });
});

describe("handler error handling", () => {
  let consoleErrorMock: jest.SpyInstance;

  beforeEach(() => {
    dynamoMock.reset();
    sqsMock.reset();
    process.env.TABLE_NAME = "TABLE_NAME";
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
  });
});
