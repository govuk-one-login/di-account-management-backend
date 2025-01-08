import { DynamoDBStreamEvent } from "aws-lambda";
import { AttributeValue } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { ActivityLogEntry, TxmaEvent } from "./common/model";
import {
  allowedTxmaEvents,
  REPORT_SUSPICIOUS_ACTIVITY_DEFAULT,
} from "./common/constants";
import { sendSqsMessage } from "./common/sqs";
import { getEnvironmentVariable } from "./common/utils";

const OUTPUT_QUEUE_URL = getEnvironmentVariable("OUTPUT_QUEUE_URL");

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
): ActivityLogEntry =>
  ({
    event_id: txmaEvent.event_id,
    event_type: txmaEvent.event_name,
    session_id: txmaEvent.user?.session_id,
    user_id: txmaEvent.user?.user_id,
    client_id: txmaEvent.client_id,
    timestamp: txmaEvent.timestamp,
    reported_suspicious: REPORT_SUSPICIOUS_ACTIVITY_DEFAULT,
  }) as ActivityLogEntry;

export const handler = async (event: DynamoDBStreamEvent): Promise<void> => {
  await Promise.all(
    event.Records.map(async (record) => {
      try {
        const txmaEvent = unmarshall(
          record.dynamodb?.NewImage?.event.M as Record<string, AttributeValue>
        ) as TxmaEvent;
        if (allowedTxmaEvents.includes(txmaEvent.event_name)) {
          validateTxmaEventBody(txmaEvent);
          const formattedRecord = formatIntoActivityLogEntry(txmaEvent);
          await sendSqsMessage(
            JSON.stringify(formattedRecord),
            OUTPUT_QUEUE_URL
          );
        }
      } catch (error) {
        throw new Error(
          `Unable to format activity log for event with ID: ${record.eventID}, ${
            (error as Error).message
          }`
        );
      }
    })
  );
};
