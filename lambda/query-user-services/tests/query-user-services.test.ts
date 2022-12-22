import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { Service, UserRecordEvent, UserServices } from "../models";
import "aws-sdk-client-mock-jest";
import {
  handler,
  sendSqsMessage,
  validateTxmaEventBody,
  validateUser,
  queryUserServices,
} from "../query-user-services";
import {
  TEST_TXMA_EVENT,
  TEST_DYNAMO_STREAM_EVENT,
  tableName,
  messageId,
  queueUrl,
  date,
  userId,
  clientId,
} from "./testHelpers";

const dynamoMock = mockClient(DynamoDBDocumentClient);
const sqsMock = mockClient(SQSClient);
const userRecordEvents: UserRecordEvent = {
  TxmaEvent: TEST_TXMA_EVENT,
  ServiceList: [
    {
      client_id: clientId,
      count_successful_logins: 2,
      last_accessed: date.valueOf(),
      last_accessed_pretty: new Intl.DateTimeFormat("en-GB", {
        dateStyle: "long",
      }).format(date),
    },
  ],
};
const serviceList: Service[] = [
  {
    client_id: clientId,
    count_successful_logins: 2,
    last_accessed: date.valueOf(),
    last_accessed_pretty: new Intl.DateTimeFormat("en-GB", {
      dateStyle: "long",
    }).format(date),
  },
];

const userServices: UserServices = {
  user_id: userId,
  services: serviceList,
};

describe("queryUserServices", () => {
  beforeEach(() => {
    dynamoMock.reset();

    process.env.TABLE_NAME = tableName;

    dynamoMock.on(GetCommand).resolves({ Item: userServices });
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
            user: {
              user_id: userId,
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
            client_id: clientId,
            event_name: "event_name",
            user: {
              user_id: userId,
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
            client_id: clientId,
            timestamp: new Date().toISOString,
            user: {
              user_id: userId,
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
            client_id: clientId,
            timestamp: new Date().toISOString,
            event_name: "event_name",
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
            client_id: clientId,
            timestamp: new Date().toISOString,
            event_name: "event_name",
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
  test("throws error when user is is missing", () => {
    const inValidUser = JSON.parse(JSON.stringify({}));
    expect(() => {
      validateUser(inValidUser);
    }).toThrowError();
  });
});

describe("sendSqsMessage", () => {
  beforeEach(() => {
    sqsMock.reset();
    process.env.QUEUE_URL = queueUrl;
  });
  afterEach(() => {
    jest.clearAllMocks();
  });
  test("Send the SQS event on the queue", async () => {
    sqsMock.on(SendMessageCommand).resolves({ MessageId: messageId });

    expect(
      await sendSqsMessage(JSON.stringify(userRecordEvents), queueUrl)
    ).toEqual(messageId);
    expect(
      sqsMock.commandCalls(SendMessageCommand, {
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(Object),
      })
    );
  });
});

describe("handler", () => {
  beforeEach(() => {
    dynamoMock.reset();
    sqsMock.reset();
    process.env.TABLE_NAME = tableName;
    process.env.OUTPUT_QUEUE_URL = queueUrl;
    sqsMock.on(SendMessageCommand).resolves({ MessageId: messageId });
    dynamoMock.on(GetCommand).resolves({ Item: userServices });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("Queries the dynamo db and send an sqs event", async () => {
    await handler(TEST_DYNAMO_STREAM_EVENT);
    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(2);
    expect(dynamoMock.commandCalls(GetCommand).length).toEqual(2);
    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(userRecordEvents),
    });
  });
});

describe("handler error handing ", () => {
  let consoleErrorMock: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorMock = jest.spyOn(global.console, "error").mockImplementation();
    dynamoMock.reset();
    sqsMock.reset();
    process.env.TABLE_NAME = tableName;
    process.env.OUTPUT_QUEUE_URL = queueUrl;
    sqsMock.on(SendMessageCommand).resolves({ MessageId: messageId });
    dynamoMock.rejectsOnce("mock error");
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleErrorMock.mockRestore();
  });
  test("logs the error message", async () => {
    await handler(TEST_DYNAMO_STREAM_EVENT);
    expect(consoleErrorMock).toHaveBeenCalledTimes(2);
  });
  test("sends the event to dead letter queue", async () => {
    await handler(TEST_DYNAMO_STREAM_EVENT);
    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(2);
  });
});
