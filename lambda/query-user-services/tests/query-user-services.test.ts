import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBStreamEvent, DynamoDBRecord } from "aws-lambda";
import { mockClient } from "aws-sdk-client-mock";
import {
  Service,
  TxmaEvent,
  UserData,
  UserRecordEvent,
  UserServices,
} from "../models";
import "aws-sdk-client-mock-jest";
import {
  handler,
  sendSqsMessage,
  validateTxmaEventBody,
  validateUser,
  queryUserServices,
} from "../query-user-services";

const userId = "user_id";
const date = new Date();
const timestamp = date.valueOf();
const timestampFormatted = date.toISOString();
const govukSigninJourneyId = "abc123";
const user: UserData = {
  user_id: userId,
  govuk_signin_journey_id: govukSigninJourneyId,
};
const TEST_TXMA_EVENT: TxmaEvent = {
  event_id: "event_id",
  event_name: "event_name",
  timestamp,
  timestamp_formatted: timestampFormatted,
  client_id: "client_id",
  user,
};

const TEST_DYNAMO_STREAM_RECORD: DynamoDBRecord = {
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
            S: "event_name",
          },
          timestamp: {
            N: `${timestamp}`,
          },
          timestamp_formatted: {
            S: timestampFormatted,
          },
          client_id: {
            S: "client_id",
          },
          user: {
            M: {
              user_id: {
                S: userId,
              },
              govuk_signin_journey_id: {
                S: govukSigninJourneyId,
              },
            },
          },
        },
      },
    },
  },
};

const MOCK_MESSAGE_ID = "MyMessageId";
const MOCK_QUEUE_URL = "http://my_queue_url";
const TABLE_NAME = "TABLE_NAME";
const dynamoMock = mockClient(DynamoDBDocumentClient);
const sqsMock = mockClient(SQSClient);

const TEST_DYNAMO_STREAM_EVENT: DynamoDBStreamEvent = {
  Records: [TEST_DYNAMO_STREAM_RECORD, TEST_DYNAMO_STREAM_RECORD],
};

describe("queryUserServices", () => {
  const serviceList: Service[] = [
    {
      client_id: "client_id",
      count_successful_logins: 2,
      last_accessed: new Date(),
    },
  ];

  const userServices: UserServices = {
    user_id: "user-id",
    services: serviceList,
  };

  beforeEach(() => {
    dynamoMock.reset();

    process.env.TABLE_NAME = TABLE_NAME;

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
  beforeEach(() => {
    sqsMock.reset();
    process.env.QUEUE_URL = MOCK_QUEUE_URL;
  });
  afterEach(() => {
    jest.clearAllMocks();
  });
  test("Send the SQS event on the queue", async () => {
    sqsMock.on(SendMessageCommand).resolves({ MessageId: MOCK_MESSAGE_ID });
    const messageId = await sendSqsMessage(
      JSON.stringify(userRecordEvents),
      MOCK_QUEUE_URL
    );
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

  const userServices: UserServices = {
    user_id: "user-id",
    services: serviceList,
  };

  beforeEach(() => {
    dynamoMock.reset();
    sqsMock.reset();
    process.env.TABLE_NAME = TABLE_NAME;
    process.env.OUTPUT_QUEUE_URL = MOCK_QUEUE_URL;
    sqsMock.on(SendMessageCommand).resolves({ MessageId: MOCK_MESSAGE_ID });
    dynamoMock.on(GetCommand).resolves({ Item: userServices });
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
    await handler(TEST_DYNAMO_STREAM_EVENT);
    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(2);
    expect(dynamoMock.commandCalls(GetCommand).length).toEqual(2);
    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl: MOCK_QUEUE_URL,
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
    process.env.TABLE_NAME = TABLE_NAME;
    process.env.OUTPUT_QUEUE_URL = MOCK_QUEUE_URL;
    sqsMock.on(SendMessageCommand).resolves({ MessageId: MOCK_MESSAGE_ID });
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
