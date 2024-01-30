import "aws-sdk-client-mock-jest";
import { getItemByEventId, handler, markEventAsReported, sendSqsMessage } from '../mark-suspicious-activity-as-reported'
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import {TEST_SNS_EVENT, queueUrl, eventId, indexName, tableName, timestamp, userId } from './testFixtures'

const sqsMock = mockClient(SQSClient);
const dynamoMock = mockClient(DynamoDBDocumentClient);

describe("getItemByEventId", () => {
  beforeEach(() => {
    dynamoMock.reset();
    dynamoMock.on(QueryCommand).resolves({
      Items: [{ 'user_id': userId, 'timestamp': timestamp}]
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test("correctly retreives the event from the datastore", async () => {
    await getItemByEventId(tableName, indexName, eventId)
    expect(dynamoMock.commandCalls(QueryCommand).length).toEqual(1);
    expect(dynamoMock).toHaveReceivedCommandWith(QueryCommand, {
      TableName: tableName,
      IndexName: indexName,
      ExpressionAttributeValues: {
        ":event_id": eventId
      }
    })
  });

  test('returns the user id and timestamp', async () => {
    const response = await getItemByEventId(tableName, indexName, eventId)
    expect(response).toEqual({ 'userId': userId, 'timestamp': timestamp })
  })
});

describe("markEventAsReported", () => {
  beforeEach(() => {
    dynamoMock.reset();
  })

  afterEach(() => {
    jest.clearAllMocks();
  })

  test("updates the correct event as reported", async () => {
    await markEventAsReported(tableName, userId, timestamp)
    expect(dynamoMock.commandCalls(UpdateCommand).length).toEqual(1)
    expect(dynamoMock).toHaveReceivedCommandWith(UpdateCommand, {
      TableName: tableName,
      Key: {
        user_id: userId,
        timestamp: timestamp
      },
      UpdateExpression: "set reported_suspicious = :reported_suspicious",
      ExpressionAttributeValues: {
        ":reported_suspicious": true
      }
    })
  })
})

describe('handler', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    jest.resetModules()

    process.env = { ...OLD_ENV }
    process.env.TABLE_NAME = tableName
    process.env.DLQ_URL = queueUrl
    process.env.INDEX_NAME = indexName

    dynamoMock.reset();

    dynamoMock.on(QueryCommand).resolves({
      Items: [{ 'user_id': userId, 'timestamp': timestamp }]
    })

    sqsMock.on(SendMessageCommand).resolves({ MessageId: "MessageId" });
  })

  afterEach(() => {
    jest.clearAllMocks();
    process.env = OLD_ENV
  })

  test('the handler makes the correct queries', async () => {
    await handler(TEST_SNS_EVENT)
    expect(dynamoMock.commandCalls(QueryCommand).length).toEqual(1)
    expect(dynamoMock.commandCalls(UpdateCommand).length).toEqual(1)

    expect(dynamoMock).toHaveReceivedCommandWith(QueryCommand, {
      TableName: tableName,
      IndexName: indexName,
      ExpressionAttributeValues: {
        ":event_id": eventId
      }
    })

    expect(dynamoMock).toHaveReceivedCommandWith(UpdateCommand, {
      TableName: tableName,
      Key: {
        user_id: userId,
        timestamp: timestamp
      },
      UpdateExpression: "set reported_suspicious = :reported_suspicious",
      ExpressionAttributeValues: {
        ":reported_suspicious": true
      }
    })
  })

  test('the handler sends to DLQ if there is an error', async () => {
    process.env.TABLE_NAME = undefined
    await handler(TEST_SNS_EVENT)
    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(1)
  })
})

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

