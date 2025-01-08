import dotenv from "dotenv";
dotenv.config({ path: ".env.test" });
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import {
  Service,
  TxmaEvent,
  UserData,
  UserRecordEvent,
  UserServices,
} from "../common/model";
import "aws-sdk-client-mock-jest";
import {
  handler,
  validateTxmaEventBody,
  validateUser,
  queryUserServices,
} from "../query-user-services";
import { DynamoDBStreamEvent, DynamoDBRecord } from "aws-lambda";
import { sendSqsMessage } from "../common/sqs";

export const userId = "user_id";
export const clientId = "client_id";
export const date = new Date();
export const tableName = "TableName";
export const messageId = "MyMessageId";
export const queueUrl = process.env.OUTPUT_QUEUE_URL;
export const dlqUrl = "DlqUrl";
const timestamp = date.valueOf();

const user: UserData = {
  user_id: userId,
};

const generateTestTxmaEvent = (
  txmaEventName = "AUTH_AUTH_CODE_ISSUED"
): TxmaEvent => ({
  event_id: "event_id",
  event_name: `${txmaEventName}`,
  timestamp,
  client_id: clientId,
  user,
});

const generateDynamoSteamRecord = (
  txmaEventName = "AUTH_AUTH_CODE_ISSUED"
): DynamoDBRecord => ({
  eventID: "1234567",
  eventName: "INSERT",
  dynamodb: {
    ApproximateCreationDateTime: Date.now(),
    NewImage: {
      remove_at: {
        N: "1676378763",
      },
      id: { S: "event-id" },
      timestamp: { N: `${Date.now()}` },
      event: {
        M: {
          event_id: {
            S: "event_id",
          },
          event_name: {
            S: `${txmaEventName}`,
          },
          timestamp: {
            N: `${timestamp}`,
          },
          client_id: {
            S: clientId,
          },
          user: {
            M: {
              user_id: {
                S: userId,
              },
            },
          },
        },
      },
    },
  },
});

export const TEST_DYNAMO_STREAM_EVENT: DynamoDBStreamEvent = {
  Records: [generateDynamoSteamRecord(), generateDynamoSteamRecord()],
};

export const MUCKY_DYNAMODB_STREAM_EVENT: DynamoDBStreamEvent = {
  Records: [
    generateDynamoSteamRecord("AUTH_IPV_AUTHORISATION_REQUESTED"),
    generateDynamoSteamRecord(),
    generateDynamoSteamRecord("AUTH_OTHER_RANDOM_EVENT"),
  ],
};

export const TEST_TXMA_EVENT: TxmaEvent = generateTestTxmaEvent();

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
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    dynamoMock.reset();
    dynamoMock.on(GetCommand).resolves({ Item: userServices });
  });

  afterEach(() => {
    process.env = OLD_ENV;
    jest.clearAllMocks();
  });

  test("Query user service", async () => {
    const services: Service[] = await queryUserServices(userId);
    expect(services).not.toBeNull();
    expect(services.length).toEqual(1);
    expect(services.sort).toEqual(serviceList.sort);
  });

  test("Query user service empty list", async () => {
    dynamoMock.on(GetCommand).resolves({ Item: undefined });
    const services: Service[] = await queryUserServices(userId);
    expect(services).not.toBeNull();
    expect(services.length).toEqual(0);
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
            event_name: "AUTH_AUTH_CODE_ISSUED",
            user: {
              user_id: userId,
            },
          },
        ],
      })
    );
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrow();
  });
  test("throws error when timestamp is missing", () => {
    const txmaEvent = JSON.parse(
      JSON.stringify({
        services: [
          {
            client_id: clientId,
            event_name: "AUTH_AUTH_CODE_ISSUED",
            user: {
              user_id: userId,
            },
          },
        ],
      })
    );
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrow();
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
    }).toThrow();
  });
  test(" throws error when user is missing", () => {
    const txmaEvent = JSON.parse(
      JSON.stringify({
        services: [
          {
            client_id: clientId,
            timestamp: new Date().toISOString,
            event_name: "AUTH_AUTH_CODE_ISSUED",
          },
        ],
      })
    );
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrow();
  });
  test("throws error when user_id  is missing", () => {
    const txmaEvent = JSON.parse(
      JSON.stringify({
        services: [
          {
            client_id: clientId,
            timestamp: new Date().toISOString,
            event_name: "AUTH_AUTH_CODE_ISSUED",
            user: {},
          },
        ],
      })
    );
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrow();
  });
});

describe("validateUser", () => {
  test("throws error when user is is missing", () => {
    const inValidUser = JSON.parse(JSON.stringify({}));
    expect(() => {
      validateUser(inValidUser);
    }).toThrow();
  });
});

describe("sendSqsMessage", () => {
  beforeEach(() => {
    sqsMock.reset();
    process.env.QUEUE_URL = queueUrl;
    process.env.AWS_REGION = "AWS_REGION";
  });
  afterEach(() => {
    jest.clearAllMocks();
  });
  test("Send the SQS event on the queue", async () => {
    sqsMock.on(SendMessageCommand).resolves({ MessageId: messageId });

    expect(
      (await sendSqsMessage(JSON.stringify(userRecordEvents), queueUrl))
        .MessageId
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
    expect(sqsMock).toHaveReceivedNthCommandWith(1, SendMessageCommand, {
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(userRecordEvents),
    });
    expect(sqsMock).toHaveReceivedNthCommandWith(2, SendMessageCommand, {
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(userRecordEvents),
    });
  });

  test("Ignores any non-AUTH_AUTH_CODE_ISSUED event", async () => {
    await handler(MUCKY_DYNAMODB_STREAM_EVENT);
    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(1);
    expect(dynamoMock.commandCalls(GetCommand).length).toEqual(1);
    expect(sqsMock).toHaveReceivedNthCommandWith(1, SendMessageCommand, {
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(userRecordEvents),
    });
  });
});

describe("handler error handing ", () => {
  beforeEach(() => {
    dynamoMock.reset();
    sqsMock.reset();
    process.env.TABLE_NAME = tableName;
    process.env.OUTPUT_QUEUE_URL = queueUrl;
    sqsMock.on(SendMessageCommand).resolves({ MessageId: messageId });
    dynamoMock.rejectsOnce("mock error");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("logs the error message", async () => {
    let errorMessage;
    try {
      await handler(TEST_DYNAMO_STREAM_EVENT);
    } catch (error) {
      errorMessage = (error as Error).message;
    }

    expect(errorMessage).toContain(
      "Unable to query user services for message with ID: 1234567, mock error"
    );
  });
});
