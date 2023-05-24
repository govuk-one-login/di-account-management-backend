import { SQSEvent, SQSRecord } from "aws-lambda";

import { ActivityLogEntry } from "../models";
import { TooManyEntriesInBatchRequest } from "@aws-sdk/client-sqs";

// Activity log entry constants
export const event_type = "TXMA_EVENT";
export const sessionId = "123456789";
export const userId = "qwerty";
export const timestamp = 123456789;
export const truncated = false;

// Activity constants
export const clientId = "client-id-value";
export const type = "activity-type-value";

var MUTABLE_ACTIVITY_LOG_ENTRY: ActivityLogEntry = {
  event_type: event_type,
  session_id: sessionId,
  user_id: userId,
  timestamp: timestamp,
  truncated: truncated,
  activities: [
    {
      client_id: clientId,
      timestamp: timestamp,
      type: type
    }
  ],
};

export const TEST_ACTIVITY_LOG_ENTRY: ActivityLogEntry = MUTABLE_ACTIVITY_LOG_ENTRY;

const NO_ACTIVITY_ARRAY = { 
  ...MUTABLE_ACTIVITY_LOG_ENTRY, activities: undefined };
export const ACTIVITY_LOG_ENTRY_NO_ACTIVITY_ARRAY: ActivityLogEntry = 
  JSON.parse(JSON.stringify(NO_ACTIVITY_ARRAY));


const NO_USER_ID = { 
  ...MUTABLE_ACTIVITY_LOG_ENTRY, user_id: undefined };
export const ACTIVITY_LOG_ENTRY_NO_USER_ID: ActivityLogEntry = 
  JSON.parse(JSON.stringify(NO_USER_ID));

const NO_TIMESTAMP = { 
    ...MUTABLE_ACTIVITY_LOG_ENTRY, timestamp: undefined };
export const ACTIVITY_LOG_ENTRY_NO_TIMESTAMP: ActivityLogEntry = 
  JSON.parse(JSON.stringify(NO_TIMESTAMP));