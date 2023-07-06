import { SQSEvent } from "aws-lambda";

import {
  SendMessageCommand,
  SendMessageRequest,
  SQSClient,
} from "@aws-sdk/client-sqs";
import {
  Activity,
  ActivityLogEntry,
  TxmaEvent,
  UserActivityLog,
  UserData,
} from "./models";

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
    throw new Error(`Could not validate User`);
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
    throw new Error(`Could not validate UserServices`);
  }
};

export const validateUserActivityLog = (
  userActivityLog: UserActivityLog
): void => {
  if (!userActivityLog.txmaEvent) {
    throw new Error(`Could not validate UserActivityLog`);
  } else {
    validateTxmaEventBody(userActivityLog.txmaEvent);
  }
};

export const formatIntoActivitLogEntry = (
  userActivityLog: UserActivityLog
): ActivityLogEntry => {
  if (userActivityLog.activityLogEntry === undefined) {
    return createNewActivityLogEntryFromTxmaEvent(userActivityLog.txmaEvent);
  }
  if (userActivityLog.activityLogEntry.activities.length < 100) {
    userActivityLog.activityLogEntry.activities.push(
      activityFromTxmaEvent(userActivityLog.txmaEvent)
    );
    return userActivityLog.activityLogEntry;
  }
  return { ...userActivityLog.activityLogEntry, truncated: true };
};

export const sendSqsMessage = async (
  messageBody: string,
  queueUrl: string | undefined
): Promise<string | undefined> => {
  const { AWS_REGION } = process.env;
  const client = new SQSClient({ region: AWS_REGION });
  const message: SendMessageRequest = {
    QueueUrl: queueUrl,
    MessageBody: messageBody,
  };
  const result = await client.send(new SendMessageCommand(message));
  return result.MessageId;
};

export const handler = async (event: SQSEvent): Promise<void> => {
  const { OUTPUT_QUEUE_URL, DLQ_URL } = process.env;
  const { Records } = event;

  await Promise.all(
    Records.map(async (record) => {
      try {
        const userActivityLog: UserActivityLog = JSON.parse(record.body);
        validateUserActivityLog(userActivityLog);
        const formattedRecord = formatIntoActivitLogEntry(userActivityLog);
        const messageId = await sendSqsMessage(
          JSON.stringify(formattedRecord),
          OUTPUT_QUEUE_URL
        );
        console.log(`[Message sent to QUEUE] with message id = ${messageId}`);
      } catch (err) {
        console.error(err);
        await sendSqsMessage(record.body, DLQ_URL);
      }
    })
  );
};
