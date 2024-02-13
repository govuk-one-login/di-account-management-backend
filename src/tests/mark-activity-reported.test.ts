import "aws-sdk-client-mock-jest";
import {
  handler,
  markEventAsReported,
  sendSqsMessage,
} from "../mark-activity-reported";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import {
  TEST_SNS_EVENT_WITH_EVENT,
  queueUrl,
  eventId,
  indexName,
  tableName,
  userId,
} from "./testFixtures";

const sqsMock = mockClient(SQSClient);
const dynamoMock = mockClient(DynamoDBDocumentClient);

describe("markEventAsReported", () => {
  beforeEach(() => {
    dynamoMock.reset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("updates the correct event as reported", async () => {
    await markEventAsReported(tableName, userId, eventId);
    expect(dynamoMock.commandCalls(UpdateCommand).length).toEqual(1);
    expect(dynamoMock).toHaveReceivedCommandWith(UpdateCommand, {
      TableName: tableName,
      Key: {
        user_id: userId,
        event_id: eventId,
      },
      UpdateExpression: "set reported_suspicious = :reported_suspicious",
      ExpressionAttributeValues: {
        ":reported_suspicious": true,
      },
    });
  });
});

describe("handler", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();

    process.env = { ...OLD_ENV };
    process.env.TABLE_NAME = tableName;
    process.env.DLQ_URL = queueUrl;
    process.env.INDEX_NAME = indexName;

    dynamoMock.reset();

    sqsMock.on(SendMessageCommand).resolves({ MessageId: "MessageId" });
  });

  afterEach(() => {
    jest.clearAllMocks();
    process.env = OLD_ENV;
  });

  test("the handler makes the correct queries", async () => {
    await handler(TEST_SNS_EVENT_WITH_EVENT);
    expect(dynamoMock.commandCalls(UpdateCommand).length).toEqual(1);

    expect(dynamoMock).toHaveReceivedCommandWith(UpdateCommand, {
      TableName: tableName,
      Key: {
        user_id: userId,
        event_id: eventId,
      },
      UpdateExpression: "set reported_suspicious = :reported_suspicious",
      ExpressionAttributeValues: {
        ":reported_suspicious": true,
      },
    });
  });

  test("the handler sends to DLQ if there is an error", async () => {
    process.env.TABLE_NAME = undefined;
    await handler(TEST_SNS_EVENT_WITH_EVENT);
    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(1);
  });
});

describe("sendSQSMessage", () => {
  beforeEach(() => {
    sqsMock.reset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("send sqs successfully", async () => {
    const txMAEvent = {
      component_id: "https://home.account.gov.uk",
      event_name: "HOME_REPORT_SUSPICIOUS_ACTIVITY",
      extensions: {
        reported_session_id: "111111",
      },
      user: {
        persistent_session_id: "111111",
        session_id: "111112",
        user_id: "1234567",
      },
    };
    await sendSqsMessage(JSON.stringify(txMAEvent), "TXMA_QUEUE_URL");
    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(1);
    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl: "TXMA_QUEUE_URL",
      MessageBody: JSON.stringify(txMAEvent),
    });
  });
});
