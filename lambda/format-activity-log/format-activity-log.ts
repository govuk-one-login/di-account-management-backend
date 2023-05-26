import { SQSEvent } from "aws-lambda";

import {
  Activity,
  ActivityLogEntry,
  TxmaEvent,
  UserActivityLog,
  UserData,
} from "./models";

export const handler = async (event: SQSEvent): Promise<void> => {};

export const formatIntoActivitLogEntry = (
  userActivityLog: UserActivityLog
): ActivityLogEntry => {
  if (userActivityLog.activityLogEntry == undefined) {
    return createNewActivityLogEntryFromTxmaEvent(userActivityLog.txmaEvent);
  } else {
    userActivityLog.activityLogEntry.activities.push(
      activityFromTxmaEvent(userActivityLog.txmaEvent)
    );
    return userActivityLog.activityLogEntry;
  }
};

const createNewActivityLogEntryFromTxmaEvent = (
  txmaEvent: TxmaEvent
): ActivityLogEntry => ({
  event_type: txmaEvent.event_name,
  session_id: txmaEvent.user.session_id,
  user_id: txmaEvent.user.user_id,
  timestamp: txmaEvent.timestamp,
  activities: [
    {
      type: txmaEvent.event_name,
      client_id: txmaEvent.client_id,
      timestamp: txmaEvent.timestamp,
    },
  ],
  truncated: false,
});

const activityFromTxmaEvent = (txmaEvent: TxmaEvent): Activity => ({
  type: txmaEvent.event_name,
  client_id: txmaEvent.client_id,
  timestamp: txmaEvent.timestamp,
});

export const validateUser = (user: UserData): void => {
  if (!user.user_id || !user.session_id) {
    throw new Error(`Could not validate User ${JSON.stringify(user)}`);
  }
};

export const validateTxmaEventBody = (txmaEvent: TxmaEvent): void => {
  if (
    txmaEvent.timestamp !== undefined &&
    txmaEvent.event_name !== undefined &&
    txmaEvent.client_id !== undefined &&
    txmaEvent.user !== undefined
  ) {
    validateUser(txmaEvent.user);
  } else {
    throw new Error(
      `Could not validate UserServices ${JSON.stringify(txmaEvent)}`
    );
  }
};

export const validateUserActivityLog = (
  userActivityLog: UserActivityLog
): void => {
  if (!userActivityLog.txmaEvent) {
    throw new Error(
      `Could not validate UserActivityLog ${JSON.stringify(userActivityLog)}`
    );
  } else {
    validateTxmaEventBody(userActivityLog.txmaEvent);
  }
};
