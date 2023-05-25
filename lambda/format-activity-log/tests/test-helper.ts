import { TxmaEvent, ActivityLogEntry, UserData, UserActivityLog } from "../models"


export const txmaEventId = "12345678"
export const eventType = "AUTH_AUTH_CODE_ISSUED";
export const sessionId = "123456789";
export const userId = "qwerty";
export const timestamp = 123456789;
export const truncated = false;
export const clientId = "client-id-value";

var MUTABLE_USER_DATA: UserData = {
    user_id: userId,
    govuk_signin_journey_id: "234567",
    session_id: sessionId
};

var MUTABLE_TXMA_EVENT: TxmaEvent = {
    event_id: txmaEventId,
    timestamp: timestamp,
    timestamp_formatted: "x",
    event_name: eventType,
    client_id: clientId,
    user: MUTABLE_USER_DATA
};

var MUTABLE_ACTIVITY_LOG_ENTRY: ActivityLogEntry = {
  event_type: eventType,
  session_id: sessionId,
  user_id: userId,
  timestamp: timestamp,
  truncated: truncated,
  activities: [
    {
      client_id: clientId,
      timestamp: timestamp,
      type: txmaEventId
    }
  ],
};

export const TEST_TXMA_EVENT: TxmaEvent = MUTABLE_TXMA_EVENT;
export const TEST_ACTIVITY_LOG_ENTRY: ActivityLogEntry = MUTABLE_ACTIVITY_LOG_ENTRY;


export const TEST_USER_ACTIVITY_LOG_NO_LOG_ENTRY: UserActivityLog = {
    txmaEvent: MUTABLE_TXMA_EVENT,
    activityLogEntry: undefined
};