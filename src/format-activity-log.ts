import { Context, DynamoDBStreamEvent } from "aws-lambda";
import { AttributeValue } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { ActivityLogEntry, DroppedEventError, TxmaEvent } from "./common/model.js";
import {
  allowedTxmaEvents,
  REPORT_SUSPICIOUS_ACTIVITY_DEFAULT,
} from "./common/constants.js";
import { sendSqsMessage } from "./common/sqs.js";
import { getEnvironmentVariable } from "./common/utils.js";
import { filterClients, getClientIDs } from "di-account-management-rp-registry";
import { Logger } from "@aws-lambda-powertools/logger";
import { MetricUnit } from "@aws-lambda-powertools/metrics";
import { initMetrics } from "./common/metrics.js";

const logger = new Logger();
const metrics = initMetrics("format-activity-log");

const createNewActivityLogEntryFromTxmaEvent = (
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

export const validateTxmaEventBody = (txmaEvent: TxmaEvent): void => {
  const txmaClientId = txmaEvent.client_id;
  const ENVIRONMENT = getEnvironmentVariable("ENVIRONMENT");

  if (
    filterClients(ENVIRONMENT, { showInActivityHistory: false }).some(
      (client) => client.clientId === txmaClientId
    )
  ) {
    throw new DroppedEventError(
      `Event dropped as we are not displaying the RP in the activty history page.`
    );
  }

  if (txmaClientId && !getClientIDs(ENVIRONMENT).includes(txmaClientId)) {
    metrics.addDimension("clientId", txmaClientId);
    metrics.addMetric("unknownClientIdReceived", MetricUnit.Count, 1);
    logger.warn(`The client: "${txmaClientId}" is not in the RP registry.`);
  }

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

export const handler = async (
  event: DynamoDBStreamEvent,
  context: Context
): Promise<void> => {
  logger.addContext(context);
  const { Records } = event;
  const OUTPUT_QUEUE_URL = getEnvironmentVariable("OUTPUT_QUEUE_URL");
  await Promise.all(
    Records.map(async (record) => {
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
        } else {
          logger.info(
            `DB stream sent a ${txmaEvent.event_name} event. Ignoring.`
          );
        }
      } catch (error) {
        if (error instanceof DroppedEventError) {
          logger.info(error.message);
        } else {
          throw new Error(
            `Unable to format activity log for event with ID: ${record.eventID}, ${
              (error as Error).message
            }`, { cause: error }
          );
        }
      }
    })
  );
  metrics.publishStoredMetrics();
};
