import { SQSEvent, SQSRecord } from "aws-lambda";
import {
  Activity,
  ActivityLogEntry,
  EncryptedActivityLogEntry,
} from "../models";

export const eventId = "event_id";
export const eventType = "TXMA_EVENT";
export const sessionId = "123456789";
export const userId = "qwerty";
export const timestamp = 123456789;
export const isTruncated = false;
export const clientId = "client-id-value";

export const activities: Activity[] = [
  {
    client_id: clientId,
    timestamp,
    type: eventType,
    event_id: eventId,
  },
];

export const TEST_ACTIVITY_LOG_ENTRY: ActivityLogEntry = {
  event_type: eventType,
  session_id: sessionId,
  user_id: userId,
  timestamp,
  truncated: isTruncated,
  activities,
};

const NO_ACTIVITY_ARRAY = { ...TEST_ACTIVITY_LOG_ENTRY, activities: undefined };
export const ACTIVITY_LOG_ENTRY_NO_ACTIVITY_ARRAY: ActivityLogEntry =
  JSON.parse(JSON.stringify(NO_ACTIVITY_ARRAY));

const NO_USER_ID = { ...TEST_ACTIVITY_LOG_ENTRY, user_id: undefined };
export const ACTIVITY_LOG_ENTRY_NO_USER_ID: ActivityLogEntry = JSON.parse(
  JSON.stringify(NO_USER_ID)
);

const NO_TIMESTAMP = { ...TEST_ACTIVITY_LOG_ENTRY, timestamp: undefined };
export const ACTIVITY_LOG_ENTRY_NO_TIMESTAMP: ActivityLogEntry = JSON.parse(
  JSON.stringify(NO_TIMESTAMP)
);

const ACTIVITY_UNDEFINED_TYPE = {
  client_id: clientId,
  timestamp,
};
const TEST_ACTIVITY_UNDEFINED_TYPE: Activity = JSON.parse(
  JSON.stringify(ACTIVITY_UNDEFINED_TYPE)
);
export const TEST_ACTIVITY_LOG_WITH_ACTIVITY_TYPE_UNDEFINED = {
  ...TEST_ACTIVITY_LOG_ENTRY,
  activities: [TEST_ACTIVITY_UNDEFINED_TYPE],
};

const TEST_SQS_RECORD: SQSRecord = {
  messageId: "19dd0b57-b21e-4ac1-bd88-01bbb068cb78",
  receiptHandle: "MessageReceiptHandle",
  body: JSON.stringify(TEST_ACTIVITY_LOG_ENTRY),
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

export const TEST_ENCRYPTED_ACTIVITY_LOG_ENTRY: EncryptedActivityLogEntry = {
  event_type: eventType,
  session_id: sessionId,
  user_id: userId,
  timestamp,
  truncated: isTruncated,
  activities: "ASDFASDFASDF",
};
