import { SQSEvent, SQSRecord } from "aws-lambda";
import {
  TxmaEvent,
  ActivityLogEntry,
  UserData,
  UserActivityLog,
  Activity,
} from "../models";

export const txmaEventId = "12345678";
export const eventType = "AUTH_AUTH_CODE_ISSUED";
export const secondEventType = "ADDITIONAL_TXMA_EVENT";
export const sessionId = "123456789";
export const userId = "qwerty";
export const timestamp = 123456789;
export const truncated = false;
export const clientId = "client-id-value";
export const queueUrl = "http://my_queue_url";
export const messageId = "MyMessageId";
export const tableName = "tableName";

const MUTABLE_USER_DATA: UserData = {
  user_id: userId,
  govuk_signin_journey_id: "234567",
  session_id: sessionId,
};

const MUTABLE_TXMA_EVENT: TxmaEvent = {
  event_id: txmaEventId,
  timestamp,
  timestamp_formatted: "x",
  event_name: eventType,
  client_id: clientId,
  user: MUTABLE_USER_DATA,
};

export const activity: Activity = {
  client_id: clientId,
  timestamp,
  type: eventType,
};

export const MUTABLE_ACTIVITY_LOG_ENTRY: ActivityLogEntry = {
  event_type: eventType,
  session_id: sessionId,
  user_id: userId,
  timestamp,
  activities: [
    {
      type: eventType,
      client_id: clientId,
      timestamp,
    },
  ],
  truncated,
};

export const TEST_ACTIVITY_LOG_ENTRY: ActivityLogEntry =
  MUTABLE_ACTIVITY_LOG_ENTRY;

export const TEST_USER_ACTIVITY_LOG_UNDEFINED_LOG_ENTRY: UserActivityLog = {
  txmaEvent: MUTABLE_TXMA_EVENT,
  activityLogEntry: undefined,
};

const NO_ACTIVITY_ARRAY = {
  ...MUTABLE_ACTIVITY_LOG_ENTRY,
  activities: undefined,
};
export const ACTIVITY_LOG_ENTRY_NO_ACTIVITY_ARRAY: ActivityLogEntry =
  JSON.parse(JSON.stringify(NO_ACTIVITY_ARRAY));

const SECOND_TXMA_EVENT: TxmaEvent = {
  ...MUTABLE_TXMA_EVENT,
  event_name: secondEventType,
};

export const TEST_USER_ACTIVITY_SECOND_TXMA_EVENT: UserActivityLog = {
  txmaEvent: SECOND_TXMA_EVENT,
  activityLogEntry: MUTABLE_ACTIVITY_LOG_ENTRY,
};

const twoActivities: Activity[] = [
  {
    client_id: clientId,
    timestamp,
    type: eventType,
  },
  {
    client_id: clientId,
    timestamp,
    type: secondEventType,
  },
];
export const TEST_ACTIVITY_LOG_ENTRY_WITH_TWO_ACTIVITIES: ActivityLogEntry = {
  ...MUTABLE_ACTIVITY_LOG_ENTRY,
  activities: twoActivities,
};

const TEST_SQS_RECORD: SQSRecord = {
  messageId: "19dd0b57-b21e-4ac1-bd88-01bbb068cb78",
  receiptHandle: "MessageReceiptHandle",
  body: JSON.stringify(TEST_USER_ACTIVITY_LOG_UNDEFINED_LOG_ENTRY),
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
  Records: [TEST_SQS_RECORD, TEST_SQS_RECORD],
};
