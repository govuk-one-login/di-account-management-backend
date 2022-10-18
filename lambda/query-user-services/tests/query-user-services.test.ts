import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { SQSEvent, SQSRecord } from "aws-lambda";
import { Service, TxmaEvent, UserData, UserRecordEvent } from "../models";
import { mockClient } from "aws-sdk-client-mock";
import {
  handler,
  sendSqsMessage,
  validateTxmaEventBody,
  validateUser,
} from "../query-user-services";
import { queryUserServices } from "../query-user-services";
const userId = "user_id";
const user: UserData = {
  user_id: userId,
};
const TEST_TXMA_EVENT: TxmaEvent = {
  event_name: "event_1",
  timestamp: new Date().toISOString(),
  client_id: "client_id",
  component_id: "component_id",
  user: user,
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

const MOCK_MESSAGE_ID = "MyMessageId";
const MOCK_QUEUE_URL = "http://my_queue_url";
const tableName = "TABLE_NAME";
const dynamoMock = mockClient(DynamoDBDocumentClient);
const sqsMock = mockClient(SQSClient);

const TEST_SQS_EVENT: SQSEvent = {
  Records: [TEST_SQS_RECORD, TEST_SQS_RECORD],
};

describe("queryUserServices", () => {
  const serviceList: Service[] = [
    {
      client_id: "client_id",
      count_successful_logins: 2,
      last_accessed: new Date(),
    },
  ];
  beforeEach(() => {
    dynamoMock.reset();

    process.env.TABLE_NAME = "TABLE_NAME";

    dynamoMock.on(GetCommand).resolves({ Item: serviceList });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("Query user service", async () => {
    const services: Service[] = await queryUserServices(userId);
    expect(services).not.toBeNull();
    expect(services.length).toEqual(1);
    expect(services.sort).toEqual(serviceList.sort);
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

describe("validateUser", () => {
  test("doesn't throw an error with valid user data", () => {
    expect(validateUser(user)).toBe(undefined);
  });
});

describe("sendSqsMessage", () => {
  beforeEach(() => {
    sqsMock.reset();
  });
  afterEach(() => {
    jest.clearAllMocks();
  });
  test("Send the SQS event on the queue", async () => {
    sqsMock.on(SendMessageCommand).resolves({ MessageId: MOCK_MESSAGE_ID });
    const messageId = await sendSqsMessage(Object, MOCK_QUEUE_URL);
    expect(messageId).toEqual(MOCK_MESSAGE_ID);
    expect(
      sqsMock.commandCalls(SendMessageCommand, {
        QueueUrl: MOCK_QUEUE_URL,
        MessageBody: JSON.stringify(Object),
      })
    );
  });
});

describe("handler", () => {
  const serviceList: Service[] = [
    {
      client_id: "client_id",
      count_successful_logins: 2,
      last_accessed: new Date(),
    },
  ];
  beforeEach(() => {
    dynamoMock.reset();
    sqsMock.reset();
    process.env.TABLE_NAME = "TABLE_NAME";
    sqsMock.on(SendMessageCommand).resolves({ MessageId: MOCK_MESSAGE_ID });
    dynamoMock.on(GetCommand).resolves({ Item: serviceList });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
  const userRecordEvents: UserRecordEvent = {
    TxmaEvent: TEST_TXMA_EVENT,
    ServiceList: [
      {
        client_id: "client_id",
        count_successful_logins: 2,
        last_accessed: new Date(),
      },
    ],
  };
  test("Queries the dynamo db and send an sqs event", async () => {
    await handler(TEST_SQS_EVENT);
    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(2);
    expect(dynamoMock.commandCalls(GetCommand).length).toEqual(2);
  });
});
