import {
  handler,
  writeUserServices,
  parseRecordBody,
  validateServices,
  validateUserServices,
} from "../write-user-services";
import { Service, UserServices } from "../models";
import { ValidationError } from "../errors";

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
    await handler(TEST_SQS_EVENT);
    expect(dynamoMock.commandCalls(PutCommand).length).toEqual(2);
  });

  describe("error handling", () => {
    test("logs the error message", async () => {
      dynamoMock.rejectsOnce("mock error");
      const consoleErrorMock = jest
        .spyOn(global.console, "error")
        .mockImplementation();

      await handler(TEST_SQS_EVENT);

      expect(consoleErrorMock).toHaveBeenCalledTimes(1);
      consoleErrorMock.mockRestore();
    });
  });
});

describe("validateUserServices", () => {
  test("doesn't throw an error with valid data", () => {
    expect(validateUserServices(TEST_USER_SERVICES)).toBe(undefined);
  });

  describe("throws an error", () => {
    test("when user_id is missing", () => {
      const userServices = parseRecordBody(
        JSON.stringify({
          services: [
            {
              client_id: "client_id",
              last_accessed: new Date(),
              count_successful_logins: 1,
            },
          ],
        })
      );
      expect(() => {
        validateUserServices(userServices);
      }).toThrow(ValidationError);
    });

    test("when services is missing", () => {
      const userServices = parseRecordBody(
        JSON.stringify({
          user_id: "user-id",
        })
      );
      expect(() => {
        validateUserServices(userServices);
      }).toThrow(ValidationError);
    });

    test("when services is invalid", () => {
      const userServices = parseRecordBody(
        JSON.stringify({
          user_id: "user-id",
          services: [
            {
              last_accessed: new Date(),
              count_successful_logins: 1,
            },
          ],
        })
      );
      expect(() => {
        validateUserServices(userServices);
      }).toThrow(ValidationError);
    });
  });
});

describe("validateServices", () => {
  const parseServices = (service: any) => {
    return JSON.parse(service) as Service[];
  };

  test("doesn't throw an error with valid data", () => {
    const services = parseServices(
      JSON.stringify([
        {
          client_id: "client_id",
          last_accessed: new Date(),
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
            last_accessed: new Date(),
            count_successful_logins: 1,
          },
        ])
      );
      expect(() => {
        validateServices(services);
      }).toThrow(ValidationError);
    });

    test("when last_accessed is missing", () => {
      const services = parseServices(
        JSON.stringify([
          {
            client_id: "client-id",
            count_successful_logins: 1,
          },
        ])
      );
      expect(() => {
        validateServices(services);
      }).toThrow(ValidationError);
    });

    test("when count_successful_logins is missing", () => {
      const services = parseServices(
        JSON.stringify([
          {
            client_id: "client-id",
            last_accessed: new Date(),
          },
        ])
      );
      expect(() => {
        validateServices(services);
      }).toThrow(ValidationError);
    });

    test("when count_successful_logins less than 0", () => {
      const services = parseServices(
        JSON.stringify([
          {
            client_id: "client-id",
            last_accessed: new Date(),
            count_successful_logins: -1,
          },
        ])
      );
      expect(() => {
        validateServices(services);
      }).toThrow(ValidationError);
    });
  });
});
