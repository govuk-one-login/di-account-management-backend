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
import {
  TEST_USER_SERVICES,
  TEST_SQS_EVENT,
  date,
  tableName,
  clientId,
  userId,
} from "./test-helpers";

const dynamoMock = mockClient(DynamoDBDocumentClient);
const sqsMock = mockClient(SQSClient);

describe("writeUserServices", () => {
  beforeEach(() => {
    dynamoMock.reset();

    process.env.TABLE_NAME = tableName;
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
    process.env.TABLE_NAME = tableName;
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
      sqsMock.reset();
      sqsMock.on(SendMessageCommand).resolves({ MessageId: "MessageId" });
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
              client_id: clientId,
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
          user_id: userId,
        })
      );
      expect(() => {
        validateUserServices(userServices);
      }).toThrowError();
    });

    test("when services is invalid", () => {
      const userServices: UserServices = JSON.parse(
        JSON.stringify({
          user_id: userId,
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
          client_id: clientId,
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
            client_id: clientId,
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
            client_id: clientId,
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
            client_id: clientId,
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
            client_id: clientId,
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
