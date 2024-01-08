import { DynamoDBRecord, DynamoDBStreamEvent } from "aws-lambda";
import { TxmaEvent, ActivityLogEntry } from "../models";

export const txmaEventId = "12345678";
export const eventType = "AUTH_AUTH_CODE_ISSUED";
export const randomEventType = "AUTH_OTHER_RANDOM_EVENT";
export const sessionId = "123456789";
export const userId = "qwerty";
export const timestamp = 123456789;
export const clientId = "client-id-value";
export const queueUrl = "http://my_queue_url";
export const messageId = "MyMessageId";
export const tableName = "tableName";

export const MUTABLE_TXMA_EVENT: TxmaEvent = {
  event_id: txmaEventId,
  timestamp,
  timestamp_ms_formatted: "x",
  timestamp_ms: 1234,
  event_name: eventType,
  client_id: clientId,
  session_id: sessionId,
  user_id: userId,
};

export const MUTABLE_ACTIVITY_LOG_ENTRY: ActivityLogEntry = {
  event_id: txmaEventId,
  event_type: eventType,
  session_id: sessionId,
  user_id: userId,
  client_id: clientId,
  timestamp,
  reported_suspicious: false,
};

const generateDynamoSteamRecord = (
  txmaEventName = "AUTH_AUTH_CODE_ISSUED"
): DynamoDBRecord => ({
  eventID: "1234567",
  eventName: "INSERT",
  dynamodb: {
    ApproximateCreationDateTime: Date.now(),
    NewImage: {
      remove_at: {
        N: "1676378763",
      },
      id: { S: "event-id" },
      timestamp: { N: `${Date.now()}` },
      event: {
        M: {
          event_id: {
            S: txmaEventId,
          },
          event_name: {
            S: `${txmaEventName}`,
          },
          timestamp: {
            N: `${timestamp}`,
          },
          timestamp_ms_formatted: {
            S: "12345",
          },
          timestamp_ms: {
            N: `${timestamp}`,
          },
          client_id: {
            S: clientId,
          },
          session_id: {
            S: sessionId,
          },
          user_id: {
            S: userId,
          },
        },
      },
    },
  },
});

export const TEST_DYNAMO_STREAM_EVENT: DynamoDBStreamEvent = {
  Records: [generateDynamoSteamRecord(), generateDynamoSteamRecord()],
};

export const MUCKY_DYNAMODB_STREAM_EVENT: DynamoDBStreamEvent = {
  Records: [generateDynamoSteamRecord(randomEventType)],
};

export const ERROR_DYNAMODB_STREAM_EVENT: DynamoDBStreamEvent = {
  Records: [
    {
      eventID: "1234567",
      eventName: "INSERT",
      dynamodb: {},
    },
  ],
};
