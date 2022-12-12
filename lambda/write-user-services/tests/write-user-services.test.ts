import { SQSEvent, SQSRecord } from "aws-lambda";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { mockClient } from "aws-sdk-client-mock";
import {
  handler,
  writeUserServices,
  validateServices,
  validateUserServices,
} from "../write-user-services";
import { Service, UserServices } from "../models";

const date = new Date();

const TEST_USER_SERVICES: UserServices = {
  user_id: "user-id",
  services: [
    {
      client_id: "client_id",
      last_accessed: date.valueOf(),
      last_accessed_pretty: new Intl.DateTimeFormat("en-GB", {
        dateStyle: "long",
      }).format(date),
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
const sqsMock = mockClient(SQSClient);

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

describe("lambdaHandler", () => {
  beforeEach(() => {
    dynamoMock.reset();
    sqsMock.reset();
    process.env.TABLE_NAME = "TABLE_NAME";
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("it iterates over each record in the batch", async () => {
    await handler(TEST_SQS_EVENT);
    expect(dynamoMock.commandCalls(PutCommand).length).toEqual(2);
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
      await handler(TEST_SQS_EVENT);
      expect(consoleErrorMock).toHaveBeenCalledTimes(1);
    });

    test("sends the event to the dead letter queue", async () => {
      await handler(TEST_SQS_EVENT);
      expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(1);
    });
  });
});

describe("validateUserServices", () => {
  test("doesn't throw an error with valid data", () => {
    expect(validateUserServices(TEST_USER_SERVICES)).toBe(undefined);
  });

  describe("throws an error", () => {
    test("when user_id is missing", () => {
      const userServices = JSON.parse(
        JSON.stringify({
          services: [
            {
              client_id: "client_id",
              last_accessed: new Date().valueOf().valueOf(),
              count_successful_logins: 1,
            },
          ],
        })
      );
      expect(() => {
        validateUserServices(userServices);
      }).toThrowError();
    });

    test("when services is missing", () => {
      const userServices: UserServices = JSON.parse(
        JSON.stringify({
          user_id: "user-id",
        })
      );
      expect(() => {
        validateUserServices(userServices);
      }).toThrowError();
    });

    test("when services is invalid", () => {
      const userServices: UserServices = JSON.parse(
        JSON.stringify({
          user_id: "user-id",
          services: [
            {
              last_accessed: new Date().valueOf(),
              count_successful_logins: 1,
            },
          ],
        })
      );
      expect(() => {
        validateUserServices(userServices);
      }).toThrowError();
    });
  });
});

describe("validateServices", () => {
  const parseServices = (service: string) => {
    return JSON.parse(service) as Service[];
  };

  test("doesn't throw an error with valid data", () => {
    const services = parseServices(
      JSON.stringify([
        {
          client_id: "client_id",
          last_accessed: date.valueOf(),
          last_accessed_pretty: new Intl.DateTimeFormat("en-GB", {
            dateStyle: "long",
          }).format(date),
          count_successful_logins: 1,
        },
      ])
    );
    expect(validateServices(services)).toBe(undefined);
  });

  describe("throws an error", () => {
    test("when client_id is missing", () => {
      const services = parseServices(
        JSON.stringify([
          {
            last_accessed: date.valueOf(),
            last_accessed_pretty: new Intl.DateTimeFormat("en-GB", {
              dateStyle: "long",
            }).format(date),
            count_successful_logins: 1,
          },
        ])
      );
      expect(() => {
        validateServices(services);
      }).toThrowError();
    });

    test("when last_accessed is missing", () => {
      const services = parseServices(
        JSON.stringify([
          {
            client_id: "client-id",
            count_successful_logins: 1,
            last_accessed_pretty: new Intl.DateTimeFormat("en-GB", {
              dateStyle: "long",
            }).format(date),
          },
        ])
      );
      expect(() => {
        validateServices(services);
      }).toThrowError();
    });

    test("when last_accessed_pretty is missing", () => {
      const services = parseServices(
        JSON.stringify([
          {
            last_accessed: date.valueOf(),
            client_id: "client-id",
            count_successful_logins: 1,
          },
        ])
      );
      expect(() => {
        validateServices(services);
      }).toThrowError();
    });

    test("when count_successful_logins is missing", () => {
      const services = parseServices(
        JSON.stringify([
          {
            client_id: "client-id",
            last_accessed: new Date().valueOf(),
          },
        ])
      );
      expect(() => {
        validateServices(services);
      }).toThrowError();
    });

    test("when count_successful_logins less than 0", () => {
      const services = parseServices(
        JSON.stringify([
          {
            client_id: "client-id",
            last_accessed: new Date().valueOf(),
            count_successful_logins: -1,
          },
        ])
      );
      expect(() => {
        validateServices(services);
      }).toThrowError();
    });
  });
});
