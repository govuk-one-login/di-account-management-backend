import { SQSEvent, SQSRecord } from "aws-lambda";

import { ActivityLogEntry } from "../../shared/models";
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

export const TEST_ACTIVITY_LOG_ENTRY: ActivityLogEntry = {
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