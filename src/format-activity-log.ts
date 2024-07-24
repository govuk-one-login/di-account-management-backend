import { DynamoDBStreamEvent } from "aws-lambda";
import { AttributeValue } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { ActivityLogEntry, TxmaEvent } from "./common/model";
import {
  allowedTxmaEvents,
  REPORT_SUSPICIOUS_ACTIVITY_DEFAULT,
} from "./common/constants";
import { sendSqsMessage } from "./common/sqs";

const createNewActivityLogEntryFromTxmaEvent = (
  txmaEvent: TxmaEvent
): ActivityLogEntry =>
  <ActivityLogEntry>{
    event_id: txmaEvent.event_id,
    event_type: txmaEvent.event_name,
    session_id: txmaEvent.user?.session_id,
    user_id: txmaEvent.user?.user_id,
    client_id: txmaEvent.client_id,
    timestamp: txmaEvent.timestamp,
    reported_suspicious: REPORT_SUSPICIOUS_ACTIVITY_DEFAULT,
  };

export const validateTxmaEventBody = (txmaEvent: TxmaEvent): void => {
  if (
    txmaEvent.event_id === undefined ||
    txmaEvent.event_name === undefined ||
    txmaEvent.user?.user_id === undefined ||
    txmaEvent.timestamp === undefined ||
    txmaEvent.user?.session_id === undefined ||
    txmaEvent.client_id === undefined
  ) {
    throw new Error(`Could not validate TXMA Event Body`);
  }
};

export const formatIntoActivityLogEntry = (
  txmaEvent: TxmaEvent
): ActivityLogEntry => {
  return createNewActivityLogEntryFromTxmaEvent(txmaEvent);
};

export const handler = async (event: DynamoDBStreamEvent): Promise<void> => {
  const { OUTPUT_QUEUE_URL, DLQ_URL } = process.env;
  const { Records } = event;
  await Promise.all(
    Records.map(async (record) => {
      try {
        console.log(`started processing event with ID: ${record.eventID}`);
        if (!OUTPUT_QUEUE_URL) {
          throw new Error("OUTPUT_QUEUE_URL environment variable is not set");
        }
        if (!DLQ_URL) {
          throw new Error("DLQ_URL environment variable is not set");
        }
        const txmaEvent = unmarshall(
          record.dynamodb?.NewImage?.event.M as {
            [key: string]: AttributeValue;
          }
        ) as TxmaEvent;
        if (allowedTxmaEvents.includes(txmaEvent.event_name)) {
          validateTxmaEventBody(txmaEvent);
          const formattedRecord = formatIntoActivityLogEntry(txmaEvent);
          const { MessageId: messageId } = await sendSqsMessage(
            JSON.stringify(formattedRecord),
            OUTPUT_QUEUE_URL
          );
          console.log(`[Message sent to QUEUE] with message id = ${messageId}`);
        } else {
          console.log(
            `DB stream sent a ${txmaEvent.event_name} event. Irrelevant for activity log so ignoring`
          );
        }
        console.log(`finished processing event with ID: ${record.eventID}`);
      } catch (err) {
        console.error(
          "[Error occurred] unable to format activity log event",
          err
        );
        const messageId = await sendSqsMessage(JSON.stringify(record), DLQ_URL);
        console.error(
          `[Message sent to DLQ] with message id = ${messageId}`,
          err
        );
      }
    })
  );
};
