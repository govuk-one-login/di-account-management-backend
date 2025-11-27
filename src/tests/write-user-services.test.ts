import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { mockClient } from "aws-sdk-client-mock";
import { Service, UserServices } from "../common/model";
import {
  TEST_SQS_EVENT_WITH_USER_SERVICES,
  TEST_USER_SERVICES,
  timestamp,
} from "./testFixtures";

export const date = timestamp;
export const clientId = "clientId";
export const userId = "userId";

const dynamoMock = mockClient(DynamoDBDocumentClient);
const sqsMock = mockClient(SQSClient);
const mockLogger = {
  info: jest.fn(),
};

jest.mock("@aws-lambda-powertools/logger", () => ({
  Logger: jest.fn(() => mockLogger),
}));

import {
  handler,
  validateService,
  validateUserServices,
  writeUserServices,
} from "../write-user-services";

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
    process.env.AWS_REGION = "AWS_REGION";
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("it iterates over each record in the batch", async () => {
    await handler(TEST_SQS_EVENT_WITH_USER_SERVICES);
    expect(dynamoMock.commandCalls(PutCommand).length).toEqual(2);
  });

  test("It logs the written item size", async () => {
    await handler(TEST_SQS_EVENT_WITH_USER_SERVICES);
    expect(mockLogger.info).toHaveBeenCalledWith(
      `Writing user services with item size 159 bytes`
    );
  });

  describe("error handling", () => {
    beforeEach(() => {
      sqsMock.reset();
      sqsMock.on(SendMessageCommand).resolves({ MessageId: "MessageId" });
      dynamoMock.rejectsOnce("mock error");
    });

    test("logs the error message", async () => {
      let errorMessage;
      try {
        await handler(TEST_SQS_EVENT_WITH_USER_SERVICES);
      } catch (error) {
        errorMessage = (error as Error).message;
      }
      expect(errorMessage).toContain(
        "Unable to write user services for message with ID: 19dd0b57-b21e-4ac1-bd88-01bbb068cb78, mock error"
      );
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
      }).toThrow();
    });

    test("when services is missing", () => {
      const userServices: UserServices = JSON.parse(
        JSON.stringify({
          user_id: userId,
        })
      );
      expect(() => {
        validateUserServices(userServices);
      }).toThrow();
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
      }).toThrow();
    });
  });
});

describe("validateService", () => {
  const parseServices = (service: string) => {
    return JSON.parse(service) as Service;
  };

  test("doesn't throw an error with valid data", () => {
    const services = parseServices(
      JSON.stringify({
        client_id: clientId,
        last_accessed: date,
        last_accessed_pretty: new Intl.DateTimeFormat("en-GB", {
          dateStyle: "long",
        }).format(date),
        count_successful_logins: 1,
      })
    );
    expect(validateService(services)).toBe(undefined);
  });

  describe("throws an error", () => {
    test("when client_id is missing", () => {
      const services = parseServices(
        JSON.stringify([
          {
            last_accessed: date,
            last_accessed_pretty: new Intl.DateTimeFormat("en-GB", {
              dateStyle: "long",
            }).format(date),
            count_successful_logins: 1,
          },
        ])
      );
      expect(() => {
        validateService(services);
      }).toThrow();
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
        validateService(services);
      }).toThrow();
    });

    test("when last_accessed_pretty is missing", () => {
      const services = parseServices(
        JSON.stringify([
          {
            last_accessed: date,
            client_id: clientId,
            count_successful_logins: 1,
          },
        ])
      );
      expect(() => {
        validateService(services);
      }).toThrow();
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
        validateService(services);
      }).toThrow();
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
        validateService(services);
      }).toThrow();
    });
  });
});
