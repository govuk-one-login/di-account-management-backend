import { vi, describe, test, expect, beforeEach, afterEach, it } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import {
  formatIntoActivityLogEntry,
  handler,
  validateTxmaEventBody,
} from "../format-activity-log.js";
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
} from "./testFixtures.js";
import { sendSqsMessage } from "../common/sqs.js";
import { DynamoDBStreamEvent } from "aws-lambda";
import { DroppedEventError } from "../common/model.js";
import { Context } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";

const mockMetrics = vi.hoisted(() => ({
  addDimension: vi.fn(),
  addMetric: vi.fn(),
  publishStoredMetrics: vi.fn(),
}));
const mockInitMetrics = vi.hoisted(() => vi.fn(() => mockMetrics));
vi.mock("../common/metrics.js", () => ({
  initMetrics: mockInitMetrics,
}));

const sqsMock = mockClient(SQSClient);

describe("handler", () => {
  let loggerInfoMock: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    sqsMock.reset();
    process.env.TABLE_NAME = tableName;
    process.env.OUTPUT_QUEUE_URL = queueUrl;
    process.env.AWS_REGION = "AWS_REGION";
    process.env.ENVIRONMENT = "test";
    loggerInfoMock = vi
      .spyOn(Logger.prototype, "info")
      .mockImplementation(() => undefined);
    sqsMock.on(SendMessageCommand).resolves({ MessageId: messageId });
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("Ignores any Non allowed event", async () => {
    await handler(MUCKY_DYNAMODB_STREAM_EVENT, {} as Context);
    expect(loggerInfoMock).toHaveBeenCalledTimes(1);
    expect(loggerInfoMock).toHaveBeenCalledWith(
      `DB stream sent a ${randomEventType} event. Ignoring.`
    );
  });

  test("it writes a formatted SQS event when txma event is valid", async () => {
    await handler(TEST_DYNAMO_STREAM_EVENT, {} as Context);
    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(2);
    expect(sqsMock).toHaveReceivedNthCommandWith(SendMessageCommand, 1, {
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(MUTABLE_ACTIVITY_LOG_ENTRY),
    });
    expect(sqsMock).toHaveReceivedNthCommandWith(SendMessageCommand, 2, {
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(MUTABLE_ACTIVITY_LOG_ENTRY),
    });
  });

  test("checks rp registry and logs no warnings", async () => {
    const client_id = "EMGmY82k-92QSakDl_9keKDFmZY"; //home non prod ID

    const TEST_HMRC_EVENT: DynamoDBStreamEvent = {
      Records: [generateDynamoSteamRecord(client_id)],
    };
    Logger.prototype.warn = vi.fn();
    await handler(TEST_HMRC_EVENT, {} as Context);
    expect(Logger.prototype.warn).toHaveLength(0);
  });

  test("warn if client_id doesn't match rp registry", async () => {
    const client_id = "UNKNOWN";

    const TEST_HMRC_EVENT: DynamoDBStreamEvent = {
      Records: [generateDynamoSteamRecord(client_id)],
    };
    Logger.prototype.warn = vi.fn();
    await handler(TEST_HMRC_EVENT, {} as Context);
    expect(Logger.prototype.warn).toHaveBeenCalledWith(
      'The client: "UNKNOWN" is not in the RP registry.'
    );
    expect(mockMetrics.addDimension).toHaveBeenCalledWith("clientId", "UNKNOWN");
    expect(mockMetrics.addMetric).toHaveBeenCalledWith("unknownClientIdReceived", "Count", 1);
    expect(mockMetrics.publishStoredMetrics).toHaveBeenCalled();
  });

  test("does not emit metric when client_id is recognised", async () => {
    const client_id = "EMGmY82k-92QSakDl_9keKDFmZY"; //home non prod ID

    const TEST_EVENT: DynamoDBStreamEvent = {
      Records: [generateDynamoSteamRecord(client_id)],
    };
    await handler(TEST_EVENT, {} as Context);
    expect(mockMetrics.addMetric).not.toHaveBeenCalled();
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
      vi.clearAllMocks();
    });

    test("logs the error message", async () => {
      let errorMessage;
      try {
        await handler(ERROR_DYNAMODB_STREAM_EVENT, {} as Context);
      } catch (error) {
        errorMessage = (error as Error).message;
      }
      expect(errorMessage).toContain(
        "Unable to format activity log for event with ID: 1234567, No value defined: {}"
      );
    });

    test("drops hmrc events", async () => {
      const hmrc_client_id = "hmrcGovernmentGateway";

      const TEST_HMRC_EVENT: DynamoDBStreamEvent = {
        Records: [
          generateDynamoSteamRecord(hmrc_client_id),
          generateDynamoSteamRecord(hmrc_client_id),
        ],
      };
      Logger.prototype.info = vi.fn();
      await handler(TEST_HMRC_EVENT, {} as Context);
      expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(0);
      expect(Logger.prototype.info).toHaveBeenCalledWith(
        "Event dropped as we are not displaying the RP in the activty history page."
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
    }).toThrow();
  });

  test("throws error when event name is missing", () => {
    const invalidTxmaEvent = {
      ...MUTABLE_TXMA_EVENT,
      event_name: undefined,
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrow();
  });

  test("throws error when client_id is missing", () => {
    const invalidTxmaEvent = {
      ...MUTABLE_TXMA_EVENT,
      client_id: undefined,
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrow();
  });

  test("throws error when timestamp is missing", () => {
    const invalidTxmaEvent = {
      ...MUTABLE_TXMA_EVENT,
      timestamp: undefined,
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrow();
  });

  test(" throws error when user_id is missing", () => {
    const invalidTxmaEvent = {
      ...MUTABLE_TXMA_EVENT,
      user: { user_id: undefined, session_id: "123" },
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrow();
  });

  test("throws error when session_id  is missing", () => {
    const invalidTxmaEvent = {
      ...MUTABLE_TXMA_EVENT,
      user: { user_id: "123", session_id: undefined },
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
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
    vi.clearAllMocks();
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
