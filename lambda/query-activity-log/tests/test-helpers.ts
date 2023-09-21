import { DynamoDBStreamEvent, DynamoDBRecord } from "aws-lambda";
import {
  Activity,
  ActivityLogEntry,
  EncryptedActivityLogEntry,
  TxmaEvent,
  UserData,
} from "../models";

export const eventType = "AUTH_AUTH_CODE_ISSUED";
export const randomEventType = "AUTH_OTHER_RANDOM_EVENT";
export const userId = "user_id";
export const sessionId = "session_id";
export const clientId = "client_id";
export const eventId = "event_id";
export const date = new Date();
export const tableName = "TableName";
export const messageId = "MyMessageId";
export const queueUrl = "http://my_queue_url";
export const timestamp = date.valueOf();
export const activity: Activity = {
  type: eventType,
  client_id: clientId,
  timestamp,
  event_id: eventId,
};
export const activities = [activity, activity];
const timestampFormatted = date.toISOString();
const govukSigninJourneyId = "abc123";

const user: UserData = {
  user_id: userId,
  govuk_signin_journey_id: govukSigninJourneyId,
  session_id: sessionId,
};
const generateTestTxmaEvent = (
  txmaEventName = "AUTH_AUTH_CODE_ISSUED"
): TxmaEvent => ({
  event_id: "event_id",
  event_name: `${txmaEventName}`,
  timestamp,
  timestamp_formatted: timestampFormatted,
  client_id: clientId,
  user,
});

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
            S: "event_id",
          },
          event_name: {
            S: `${txmaEventName}`,
          },
          timestamp: {
            N: `${timestamp}`,
          },
          timestamp_formatted: {
            S: timestampFormatted,
          },
          client_id: {
            S: clientId,
          },
          user: {
            M: {
              user_id: {
                S: userId,
              },
              govuk_signin_journey_id: {
                S: govukSigninJourneyId,
              },
              session_id: {
                S: sessionId,
              },
            },
          },
        },
      },
    },
  },
});

export const TEST_DYNAMO_STREAM_EVENT: DynamoDBStreamEvent = {
  Records: [generateDynamoSteamRecord(), generateDynamoSteamRecord()],
};

export const TEST_TXMA_EVENT: TxmaEvent = generateTestTxmaEvent();

export const MUCKY_DYNAMODB_STREAM_EVENT: DynamoDBStreamEvent = {
  Records: [generateDynamoSteamRecord(randomEventType)],
};

export const TEST_ACTIVITY_LOG_ENTRY: ActivityLogEntry = {
  session_id: sessionId,
  user_id: userId,
  event_type: eventType,
  timestamp,
  activities,
  truncated: false,
};

export const TEST_ENCRYPTED_ACTIVITY_LOG_ENTRY: EncryptedActivityLogEntry = {
  session_id: sessionId,
  user_id: userId,
  event_type: eventType,
  timestamp,
  activities: JSON.stringify(activities),
  truncated: false,
};
