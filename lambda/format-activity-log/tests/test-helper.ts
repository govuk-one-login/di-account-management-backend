import { TxmaEvent, ActivityLogEntry, UserData, UserActivityLog, Activity } from "../models"

export const txmaEventId = "12345678"
export const eventType = "AUTH_AUTH_CODE_ISSUED";
export const secondEventType = "ADDITIONAL_TXMA_EVENT";
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
      type: eventType
    }
  ],
};


export const TEST_ACTIVITY_LOG_ENTRY: ActivityLogEntry = MUTABLE_ACTIVITY_LOG_ENTRY;

export const TEST_USER_ACTIVITY_LOG_UNDEFINED_LOG_ENTRY: UserActivityLog = {
    txmaEvent: MUTABLE_TXMA_EVENT,
    activityLogEntry: undefined
};

const NO_ACTIVITY_ARRAY = { ...MUTABLE_ACTIVITY_LOG_ENTRY, activities: undefined };
export const ACTIVITY_LOG_ENTRY_NO_ACTIVITY_ARRAY: ActivityLogEntry = JSON.parse(JSON.stringify(NO_ACTIVITY_ARRAY));

const SECOND_TXMA_EVENT: TxmaEvent = { ...MUTABLE_TXMA_EVENT, event_name: secondEventType}

export const TEST_USER_ACTIVITY_SECOND_TXMA_EVENT: UserActivityLog = {
    txmaEvent: SECOND_TXMA_EVENT,
    activityLogEntry: MUTABLE_ACTIVITY_LOG_ENTRY
}

const two_activities: Activity[] = [
    {
        client_id: clientId,
        timestamp: timestamp,
        type: eventType
    },
    {
        client_id: clientId,
        timestamp: timestamp,
        type: secondEventType
    }
]
export const TEST_ACTIVITY_LOG_ENTRY_WITH_TWO_ACTIVITIES: ActivityLogEntry = { ...MUTABLE_ACTIVITY_LOG_ENTRY, activities: two_activities};