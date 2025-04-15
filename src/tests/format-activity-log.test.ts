import { mockClient } from "aws-sdk-client-mock";
import "aws-sdk-client-mock-jest";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import {
  formatIntoActivityLogEntry,
  handler,
  validateTxmaEventBody,
} from "../format-activity-log";
import {
  ERROR_DYNAMODB_STREAM_EVENT,
  generateDynamoSteamRecord,
  messageId,
  MUCKY_DYNAMODB_STREAM_EVENT,
  MUTABLE_ACTIVITY_LOG_ENTRY,
  MUTABLE_TXMA_EVENT,
  queueUrl,
  randomEventType,
  tableName,
  TEST_DYNAMO_STREAM_EVENT,
} from "./testFixtures";
import { sendSqsMessage } from "../common/sqs";
import { DynamoDBStreamEvent } from "aws-lambda/trigger/dynamodb-stream";
import { DroppedEventError } from "../common/model";

const sqsMock = mockClient(SQSClient);

describe("handler", () => {
  let consoleLogMock: jest.SpyInstance;
  beforeEach(() => {
    sqsMock.reset();
    process.env.TABLE_NAME = tableName;
    process.env.OUTPUT_QUEUE_URL = queueUrl;
    process.env.AWS_REGION = "AWS_REGION";
    process.env.ENVIRONMENT = "test";
    consoleLogMock = jest.spyOn(global.console, "log").mockImplementation();
    sqsMock.on(SendMessageCommand).resolves({ MessageId: messageId });
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("Ignores any Non allowed event", async () => {
    await handler(MUCKY_DYNAMODB_STREAM_EVENT);
    expect(consoleLogMock).toHaveBeenCalledTimes(3);
    expect(consoleLogMock).toHaveBeenCalledWith(
      `DB stream sent a ${randomEventType} event. Irrelevant for activity log so ignoring`
    );
  });

  test("it writes a formatted SQS event when txma event is valid", async () => {
    await handler(TEST_DYNAMO_STREAM_EVENT);
    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(2);
    expect(sqsMock).toHaveReceivedNthCommandWith(1, SendMessageCommand, {
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(MUTABLE_ACTIVITY_LOG_ENTRY),
    });
    expect(sqsMock).toHaveReceivedNthCommandWith(2, SendMessageCommand, {
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(MUTABLE_ACTIVITY_LOG_ENTRY),
    });
  });

  describe("error handing ", () => {
    beforeEach(() => {
      sqsMock.reset();
      process.env.TABLE_NAME = tableName;
      process.env.OUTPUT_QUEUE_URL = queueUrl;
      process.env.ENVIRONMENT = "test";
      sqsMock.on(SendMessageCommand).resolves({ MessageId: messageId });
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    test("logs the error message", async () => {
      let errorMessage;
      try {
        await handler(ERROR_DYNAMODB_STREAM_EVENT);
      } catch (error) {
        errorMessage = (error as Error).message;
      }
      expect(errorMessage).toContain(
        "Unable to format activity log for event with ID: 1234567, No value defined: {}"
      );
    });

    test("drops hmrc events", async () => {
      const hmrc_client_id = "7y-bchtHDfucVR5kcAe8KaM80wg";

      const TEST_HMRC_EVENT: DynamoDBStreamEvent = {
        Records: [
          generateDynamoSteamRecord(hmrc_client_id),
          generateDynamoSteamRecord(hmrc_client_id),
        ],
      };
      console.log = jest.fn();
      await handler(TEST_HMRC_EVENT);
      expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(0);
      expect(console.log).toHaveBeenCalledWith(
        "Dropped Event encountered and ignored."
      );
    });
  });
});

describe("DroppedEventError", () => {
  it("should create an error with the correct name", () => {
    const errorMessage = "This is a test error message";
    const error = new DroppedEventError(errorMessage);

    expect(error.name).toBe("DroppedEventError");
    expect(error.message).toBe(errorMessage);
  });
});

describe("formatIntoActivityLogEntry", () => {
  test("valid txma event generates correct ActivityLogEntry", () => {
    expect(formatIntoActivityLogEntry(MUTABLE_TXMA_EVENT)).toEqual(
      MUTABLE_ACTIVITY_LOG_ENTRY
    );
  });
});

describe("validateTxmaEventBody", () => {
  test("doesn't throw an error with valid txma data", () => {
    expect(validateTxmaEventBody(MUTABLE_TXMA_EVENT)).toBe(undefined);
  });

  test("throws error when event_id is missing", () => {
    const invalidTxmaEvent = {
      ...MUTABLE_TXMA_EVENT,
      event_id: undefined,
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrowError();
  });

  test("throws error when event name is missing", () => {
    const invalidTxmaEvent = {
      ...MUTABLE_TXMA_EVENT,
      event_name: undefined,
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrowError();
  });

  test("throws error when client_id is missing", () => {
    const invalidTxmaEvent = {
      ...MUTABLE_TXMA_EVENT,
      client_id: undefined,
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrowError();
  });

  test("throws error when timestamp is missing", () => {
    const invalidTxmaEvent = {
      ...MUTABLE_TXMA_EVENT,
      timestamp: undefined,
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrowError();
  });

  test(" throws error when user_id is missing", () => {
    const invalidTxmaEvent = {
      ...MUTABLE_TXMA_EVENT,
      user: { user_id: undefined, session_id: "123" },
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrowError();
  });

  test("throws error when session_id  is missing", () => {
    const invalidTxmaEvent = {
      ...MUTABLE_TXMA_EVENT,
      user: { user_id: "123", session_id: undefined },
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrowError();
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
      (await sendSqsMessage(JSON.stringify(MUTABLE_TXMA_EVENT), queueUrl))
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
