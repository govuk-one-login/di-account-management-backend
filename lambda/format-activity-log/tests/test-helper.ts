import { DynamoDBRecord, DynamoDBStreamEvent } from "aws-lambda";
import { TxmaEvent, ActivityLogEntry, UserData } from "../models";

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

const MUTABLE_USER_DATA: UserData = {
  user_id: userId,
  govuk_signin_journey_id: "234567",
  session_id: sessionId,
};

export const MUTABLE_TXMA_EVENT: TxmaEvent = {
  event_id: txmaEventId,
  timestamp,
  timestamp_formatted: "x",
  event_name: eventType,
  client_id: clientId,
  user: MUTABLE_USER_DATA,
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
          event_name: { S: txmaEventName },
          event_id: { S: txmaEventId },
          user: {
            M: {
              user_id: { S: userId },
              session_id: { S: sessionId },
            },
          },
          client_id: { S: clientId },
          txma: { M: { configVersion: { S: "2.2.1" } } },
          timestamp: { N: `${timestamp}` },
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
