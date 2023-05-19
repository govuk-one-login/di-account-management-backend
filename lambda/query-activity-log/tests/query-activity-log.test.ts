import { mockClient } from "aws-sdk-client-mock";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import {
  sendSqsMessage,
  validateTxmaEventBody,
  validateUser,
} from "../query-activity-log";
import {
  TEST_TXMA_EVENT,
  clientId,
  eventType,
  messageId,
  queueUrl,
  sessionId,
  timestamp,
  userId,
} from "./test-helpers";
import {
  Activity,
  ActivityLogEntry,
  UserActivityLog,
} from "../../shared-models";

const sqsMock = mockClient(SQSClient);
const activityList: Activity[] = [
  {
    type: "service_visited",
    client_id: clientId,
    timestamp,
  },
];

const activityLogEntry: ActivityLogEntry = {
  event_type: eventType,
  session_id: sessionId,
  user_id: userId,
  timestamp,
  activities: activityList,
  truncated: true,
};
const userActivityLog: UserActivityLog = {
  TxmaEvent: TEST_TXMA_EVENT,
  ActivityLogEntry: activityLogEntry,
};

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
    }).toThrowError();
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
            event_name: "AUTH_AUTH_CODE_ISSUED",
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
            event_name: "AUTH_AUTH_CODE_ISSUED",
            user: {},
          },
        ],
      })
    );
    expect(() => {
      validateTxmaEventBody(txmaEvent);
    }).toThrowError();
  });

  test("throws error when session_id  is missing", () => {
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
      await sendSqsMessage(JSON.stringify(userActivityLog), queueUrl)
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
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});
