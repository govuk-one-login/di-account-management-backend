import { vi, describe, test, expect, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  addContext: vi.fn(),
}));

vi.mock("@aws-lambda-powertools/logger", () => ({
  Logger: class {
    info = mockLogger.info;
    error = mockLogger.error;
    addContext = mockLogger.addContext;
  },
}));

import {
  handler,
  validateTxmaEventBody,
  writeRawTxmaEvent,
  validateUser,
} from "../save-raw-events.js";
import { Context, SQSEvent, SQSRecord } from "aws-lambda";
import { TxmaEvent } from "../common/model.js";
import { clientId, eventId, user } from "./testFixtures.js";

const eventName = "AUTH_AUTH_CODE_ISSUED";

export const date = new Date();

export const makeTxmaEvent = (): TxmaEvent => ({
  event_name: eventName,
  event_id: eventId,
  timestamp: date.valueOf(),
  client_id: clientId,
  user,
});

const TEST_SQS_RECORD: SQSRecord = {
  messageId: "19dd0b57-b21e-4ac1-bd88-01bbb068cb78",
  receiptHandle: "MessageReceiptHandle",
  body: JSON.stringify(makeTxmaEvent()),
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

export const TEST_SQS_EVENT: SQSEvent = {
  Records: [TEST_SQS_RECORD],
};

const dynamoMock = mockClient(DynamoDBDocumentClient);
const sqsMock = mockClient(SQSClient);

const TABLE_NAME = "TABLE_NAME";
const UUID = "12345";
const TIMESTAMP = 1668505677;

describe("writeRawTxmaEvent", () => {
  beforeEach(() => {
    dynamoMock.reset();
    process.env.TABLE_NAME = TABLE_NAME;
    vi.spyOn(Date, "now").mockImplementation(() => TIMESTAMP);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    vi.spyOn(crypto, "randomUUID").mockImplementation(() => UUID);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, "now").mockRestore();
    vi.spyOn(crypto, "randomUUID").mockRestore();
  });

  test("writes raw events to DynamoDB", async () => {
    await writeRawTxmaEvent(makeTxmaEvent());
    expect(dynamoMock.commandCalls(PutCommand).length).toEqual(1);
    expect(dynamoMock).toHaveReceivedCommandWith(PutCommand, {
      TableName: process.env.TABLE_NAME,
      Item: {
        id: UUID,
        timestamp: TIMESTAMP,
        event: makeTxmaEvent(),
        remove_at: 2878106,
      },
    });
  });
});

describe("validateUser", () => {
  test("throws error when user data is missing", () => {
    const inValidUser = JSON.parse(JSON.stringify({}));
    const invalidTxmaEvent = {
      ...makeTxmaEvent(),
      user: inValidUser,
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));

    expect(() => {
      validateUser(txmaEvent);
    }).toThrow(
      new Error(
        `Could not validate User for event_name AUTH_AUTH_CODE_ISSUED with event_id ab12345a-a12b-3ced-ef12-12a3b4cd5678: user_id is undefined, session_id is undefined`
      )
    );
  });

  test("throws error when user_id key is missing", () => {
    const inValidUser = JSON.parse(
      JSON.stringify({
        ...user,
        user_id: undefined,
      })
    );
    const invalidTxmaEvent = {
      ...makeTxmaEvent(),
      user: inValidUser,
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));

    expect(() => {
      validateUser(txmaEvent);
    }).toThrow(
      new Error(
        `Could not validate User for event_name AUTH_AUTH_CODE_ISSUED with event_id ab12345a-a12b-3ced-ef12-12a3b4cd5678: user_id is undefined`
      )
    );
  });

  test("throws error when session_id key is missing", () => {
    const inValidUser = JSON.parse(
      JSON.stringify({
        ...user,
        session_id: undefined,
      })
    );
    const invalidTxmaEvent = {
      ...makeTxmaEvent(),
      user: inValidUser,
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));

    expect(() => {
      validateUser(txmaEvent);
    }).toThrow(
      new Error(
        `Could not validate User for event_name AUTH_AUTH_CODE_ISSUED with event_id ab12345a-a12b-3ced-ef12-12a3b4cd5678: session_id is undefined`
      )
    );
  });

  test("throws error when session_id value is null", () => {
    const inValidUser = JSON.parse(
      JSON.stringify({
        ...user,
        session_id: null,
      })
    );
    const invalidTxmaEvent = {
      ...makeTxmaEvent(),
      user: inValidUser,
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));

    expect(() => {
      validateUser(txmaEvent);
    }).toThrow(
      new Error(
        `Could not validate User for event_name AUTH_AUTH_CODE_ISSUED with event_id ab12345a-a12b-3ced-ef12-12a3b4cd5678: session_id is null`
      )
    );
  });

  test("does not throw when user_id is missing for AUTH_CODE_VERIFIED", () => {
    const codeVerifiedEvent = {
      ...makeTxmaEvent(),
      event_name: "AUTH_CODE_VERIFIED",
      user: { session_id: user.session_id },
    };
    const txmaEvent = JSON.parse(JSON.stringify(codeVerifiedEvent));

    expect(() => {
      validateUser(txmaEvent);
    }).not.toThrow();
  });

  test("still throws when session_id is missing for AUTH_CODE_VERIFIED", () => {
    const codeVerifiedEvent = {
      ...makeTxmaEvent(),
      event_name: "AUTH_CODE_VERIFIED",
      user: {},
    };
    const txmaEvent = JSON.parse(JSON.stringify(codeVerifiedEvent));

    expect(() => {
      validateUser(txmaEvent);
    }).toThrow(
      new Error(
        `Could not validate User for event_name AUTH_CODE_VERIFIED with event_id ab12345a-a12b-3ced-ef12-12a3b4cd5678: session_id is undefined`
      )
    );
  });

  test("does not throw when session_id is missing for AUTH_TOKEN_SENT_TO_ORCHESTRATION", () => {
    const tokenSentEvent = {
      ...makeTxmaEvent(),
      event_name: "AUTH_TOKEN_SENT_TO_ORCHESTRATION",
      user: { user_id: user.user_id },
    };
    const txmaEvent = JSON.parse(JSON.stringify(tokenSentEvent));

    expect(() => {
      validateUser(txmaEvent);
    }).not.toThrow();
  });

  test("still throws when user_id is missing for AUTH_TOKEN_SENT_TO_ORCHESTRATION", () => {
    const tokenSentEvent = {
      ...makeTxmaEvent(),
      event_name: "AUTH_TOKEN_SENT_TO_ORCHESTRATION",
      user: {},
    };
    const txmaEvent = JSON.parse(JSON.stringify(tokenSentEvent));

    expect(() => {
      validateUser(txmaEvent);
    }).toThrow(
      new Error(
        `Could not validate User for event_name AUTH_TOKEN_SENT_TO_ORCHESTRATION with event_id ab12345a-a12b-3ced-ef12-12a3b4cd5678: user_id is undefined`
      )
    );
  });
});

describe("validateTxmaEventBody", () => {
  test("doesn't throw an error with valid txma data", () => {
    expect(validateTxmaEventBody(makeTxmaEvent())).toBe(undefined);
  });

  test("throws error when client_id key is missing", () => {
    const invalidTxmaEvent = {
      ...makeTxmaEvent(),
      client_id: undefined,
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrow(
      new Error(
        `Could not validate TxmaEvent with id ${txmaEvent.event_id} and name ${txmaEvent.event_name}: txmaEvent.client_id is undefined`
      )
    );
  });

  test("throws error when client_id value is null", () => {
    const invalidTxmaEvent = {
      ...makeTxmaEvent(),
      client_id: null,
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrow(
      new Error(
        `Could not validate TxmaEvent with id ${txmaEvent.event_id} and name ${txmaEvent.event_name}: txmaEvent.client_id is null`
      )
    );
  });

  test("throws error when timestamp key is missing", () => {
    const invalidTxmaEvent = {
      ...makeTxmaEvent(),
      timestamp: undefined,
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrow(
      new Error(
        `Could not validate TxmaEvent with id ${txmaEvent.event_id} and name ${txmaEvent.event_name}: txmaEvent.timestamp is undefined`
      )
    );
  });

  test("throws error when timestamp value is null", () => {
    const invalidTxmaEvent = {
      ...makeTxmaEvent(),
      timestamp: null,
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrow(
      new Error(
        `Could not validate TxmaEvent with id ${txmaEvent.event_id} and name ${txmaEvent.event_name}: txmaEvent.timestamp is null`
      )
    );
  });

  test("throws error when event_name key is missing", () => {
    const invalidTxmaEvent = {
      ...makeTxmaEvent(),
      event_name: undefined,
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrow(
      new Error(
        `Could not validate TxmaEvent with id ${txmaEvent.event_id} and name ${txmaEvent.event_name}: txmaEvent.event_name is undefined`
      )
    );
  });

  test("throws error when event name value is null", () => {
    const invalidTxmaEvent = {
      ...makeTxmaEvent(),
      event_name: null,
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrow(
      new Error(
        `Could not validate TxmaEvent with id ${txmaEvent.event_id} and name ${txmaEvent.event_name}: txmaEvent.event_name is null`
      )
    );
  });

  test("throws error when event_id key is missing", () => {
    const invalidTxmaEvent = {
      ...makeTxmaEvent(),
      event_id: undefined,
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrow(
      new Error(
        `Could not validate TxmaEvent with id ${txmaEvent.event_id} and name ${txmaEvent.event_name}: txmaEvent.event_id is undefined`
      )
    );
  });

  test("throws error when event_id value is null", () => {
    const invalidTxmaEvent = {
      ...makeTxmaEvent(),
      event_id: null,
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrow(
      new Error(
        `Could not validate TxmaEvent with id ${txmaEvent.event_id} and name ${txmaEvent.event_name}: txmaEvent.event_id is null`
      )
    );
  });

  test("throws error when user key is missing", () => {
    const invalidTxmaEvent = {
      ...makeTxmaEvent(),
      user: undefined,
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrow(
      new Error(
        `Could not validate TxmaEvent with id ${txmaEvent.event_id} and name ${txmaEvent.event_name}: txmaEvent.user is undefined`
      )
    );
  });

  test("throws error when user_id key is missing", () => {
    const invalidTxmaEvent = {
      ...makeTxmaEvent(),
      user: {},
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrow(
      new Error(
        `Could not validate User for event_name AUTH_AUTH_CODE_ISSUED with event_id ab12345a-a12b-3ced-ef12-12a3b4cd5678: user_id is undefined, session_id is undefined`
      )
    );
  });

  test("throws error when user_id value is null", () => {
    const invalidTxmaEvent = {
      ...makeTxmaEvent(),
      user: { user_id: null, session_id: "test" },
    };
    const txmaEvent = JSON.parse(JSON.stringify(invalidTxmaEvent));
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrow(
      new Error(
        `Could not validate User for event_name AUTH_AUTH_CODE_ISSUED with event_id ab12345a-a12b-3ced-ef12-12a3b4cd5678: user_id is null`
      )
    );
  });
});

describe("handler", () => {
  beforeEach(() => {
    dynamoMock.reset();
    sqsMock.reset();
    process.env.TABLE_NAME = "TABLE_NAME";
    vi.spyOn(Date, "now").mockImplementation(() => TIMESTAMP);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    vi.spyOn(crypto, "randomUUID").mockImplementation(() => UUID);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, "now").mockRestore();
    vi.spyOn(crypto, "randomUUID").mockRestore();
  });

  test("Adds raw event to the table", async () => {
    const result = await handler(TEST_SQS_EVENT, {} as Context);
    expect(dynamoMock.commandCalls(PutCommand).length).toEqual(1);
    expect(dynamoMock).toHaveReceivedCommandWith(PutCommand, {
      TableName: process.env.TABLE_NAME,
      Item: {
        id: UUID,
        timestamp: TIMESTAMP,
        event: makeTxmaEvent(),
        remove_at: 2878106,
      },
    });
    expect(result).toEqual({ batchItemFailures: [] });
  });
});

describe("handler only saves allowlisted events", () => {
  beforeEach(() => {
    dynamoMock.reset();
    process.env.TABLE_NAME = "TABLE_NAME";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test.each([
    "AUTH_AUTH_CODE_ISSUED",
    "AUTH_IPV_AUTHORISATION_REQUESTED",
    "AUTH_IPV_SUCCESSFUL_IDENTITY_RESPONSE_RECEIVED",
    "AUTH_TOKEN_SENT_TO_ORCHESTRATION",
    "AUTH_UPDATE_EMAIL",
    "AUTH_CODE_VERIFIED",
    "AUTH_PASSKEY_VERIFICATION_SUCCESSFUL",
    "STS_REFRESH_TOKEN_ISSUED",
  ])("writes to DynamoDB when event_name is %s", async (allowedEventName) => {
    vi.spyOn(Date, "now").mockImplementation(() => TIMESTAMP);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    vi.spyOn(crypto, "randomUUID").mockImplementation(() => UUID);

    const allowedEvent: SQSEvent = {
      Records: [
        {
          ...TEST_SQS_RECORD,
          body: JSON.stringify({
            ...makeTxmaEvent(),
            event_name: allowedEventName,
          }),
        },
      ],
    };
    await handler(allowedEvent, {} as Context);
    expect(dynamoMock.commandCalls(PutCommand).length).toEqual(1);
  });

  test("writes to DynamoDB when event_name is AUTH_CODE_VERIFIED and user has no user_id", async () => {
    vi.spyOn(Date, "now").mockImplementation(() => TIMESTAMP);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    vi.spyOn(crypto, "randomUUID").mockImplementation(() => UUID);

    const codeVerifiedEvent: SQSEvent = {
      Records: [
        {
          ...TEST_SQS_RECORD,
          body: JSON.stringify({
            ...makeTxmaEvent(),
            event_name: "AUTH_CODE_VERIFIED",
            user: { session_id: user.session_id },
          }),
        },
      ],
    };
    await handler(codeVerifiedEvent, {} as Context);
    expect(dynamoMock.commandCalls(PutCommand).length).toEqual(1);
  });

  test("writes to DynamoDB when event_name is AUTH_TOKEN_SENT_TO_ORCHESTRATION and user has no session_id", async () => {
    vi.spyOn(Date, "now").mockImplementation(() => TIMESTAMP);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    vi.spyOn(crypto, "randomUUID").mockImplementation(() => UUID);

    const tokenSentEvent: SQSEvent = {
      Records: [
        {
          ...TEST_SQS_RECORD,
          body: JSON.stringify({
            ...makeTxmaEvent(),
            event_name: "AUTH_TOKEN_SENT_TO_ORCHESTRATION",
            user: { user_id: user.user_id },
          }),
        },
      ],
    };
    await handler(tokenSentEvent, {} as Context);
    expect(dynamoMock.commandCalls(PutCommand).length).toEqual(1);
  });

  test("does not write to DynamoDB and logs info when event_name is not in the allowlist", async () => {
    const ignoredEvent: SQSEvent = {
      Records: [
        {
          ...TEST_SQS_RECORD,
          body: JSON.stringify({
            ...makeTxmaEvent(),
            event_name: "AUTH_OTHER_RANDOM_EVENT",
          }),
        },
      ],
    };
    await handler(ignoredEvent, {} as Context);
    expect(dynamoMock.commandCalls(PutCommand).length).toEqual(0);
    expect(mockLogger.info).toHaveBeenCalledWith(
      "Ignoring AUTH_OTHER_RANDOM_EVENT event - not in allowlist"
    );
  });

  test("does not write to DynamoDB and logs info when event_name is missing", async () => {
    const ignoredEvent: SQSEvent = {
      Records: [
        {
          ...TEST_SQS_RECORD,
          body: JSON.stringify({
            ...makeTxmaEvent(),
            event_name: undefined,
          }),
        },
      ],
    };
    await handler(ignoredEvent, {} as Context);
    expect(dynamoMock.commandCalls(PutCommand).length).toEqual(0);
    expect(mockLogger.info).toHaveBeenCalledWith(
      "Ignoring undefined event - not in allowlist"
    );
  });

  test("processes allowlisted events normally alongside dropped events", async () => {
    vi.spyOn(Date, "now").mockImplementation(() => TIMESTAMP);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    vi.spyOn(crypto, "randomUUID").mockImplementation(() => UUID);

    const mixedEvent: SQSEvent = {
      Records: [
        {
          ...TEST_SQS_RECORD,
          body: JSON.stringify({
            ...makeTxmaEvent(),
            event_name: "AUTH_OTHER_RANDOM_EVENT",
          }),
        },
        {
          ...TEST_SQS_RECORD,
          body: JSON.stringify(makeTxmaEvent()),
        },
      ],
    };
    await handler(mixedEvent, {} as Context);
    expect(dynamoMock.commandCalls(PutCommand).length).toEqual(1);
    expect(mockLogger.info).toHaveBeenCalledTimes(1);
  });
});

describe("handler error handling", () => {
  beforeEach(() => {
    dynamoMock.reset();
    sqsMock.reset();
    process.env.TABLE_NAME = "TABLE_NAME";
    process.env.AWS_REGION = "AWS_REGION";
    sqsMock.on(SendMessageCommand).resolves({ MessageId: "MessageId" });
    dynamoMock.rejectsOnce("mock error");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("logs the error and returns the failed message ID in batchItemFailures", async () => {
    const result = await handler(TEST_SQS_EVENT, {} as Context);
    expect(mockLogger.error).toHaveBeenCalledWith(
      "Unable to save raw events for message with ID: 19dd0b57-b21e-4ac1-bd88-01bbb068cb78",
      expect.objectContaining({ error: expect.anything() })
    );
    expect(result).toEqual({
      batchItemFailures: [
        { itemIdentifier: "19dd0b57-b21e-4ac1-bd88-01bbb068cb78" },
      ],
    });
  });
});
