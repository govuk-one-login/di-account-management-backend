import { SendMessageCommandOutput } from "@aws-sdk/client-sqs";
import { Logger } from "@aws-lambda-powertools/logger";
import { sendSqsMessage } from "./sqs.js";
import { getCurrentTimestamp, getEnvironmentVariable, isSendIadAuditEventsEnabled } from "./utils.js";
import { COMPONENT_ID } from "./constants.js";
import { TxmaEvent, UserData, Extensions } from "./model.js";

const logger = new Logger();

/**
 * The event-specific parameters used to build a TxMA audit event.
 *
 * The caller supplies the data that varies per event (the user, any
 * extensions, and optionally explicit timestamps/ids). The function fills in
 * the constant fields (component_id) and the event name, and generates
 * timestamps when they are not provided.
 */
export interface AuditEventParameters {
  user: UserData;
  event_id?: string;
  client_id?: string;
  timestamp?: number;
  event_timestamp_ms?: number;
  timestamp_formatted?: string;
  event_timestamp_ms_formatted?: string;
  component_id?: string;
  extensions?: Extensions;
}

/**
 * Builds a TxMA audit event from an event name and a set of parameters.
 *
 * @param eventName - The name of the event (populates `event_name`).
 * @param parameters - The event-specific parameters.
 * @returns A fully populated TxMA event.
 */
export function buildTxmaEvent(
  eventName: string,
  parameters: AuditEventParameters
): TxmaEvent {
  const timestamps = getCurrentTimestamp();

  return {
    event_name: eventName,
    component_id: parameters.component_id ?? COMPONENT_ID,
    timestamp: parameters.timestamp ?? timestamps.seconds,
    event_timestamp_ms:
      parameters.event_timestamp_ms ?? timestamps.milliseconds,
    event_timestamp_ms_formatted:
      parameters.event_timestamp_ms_formatted ?? timestamps.isoString,
    user: parameters.user,
    ...(parameters.event_id !== undefined && {
      event_id: parameters.event_id,
    }),
    ...(parameters.client_id !== undefined && {
      client_id: parameters.client_id,
    }),
    ...(parameters.timestamp_formatted !== undefined && {
      timestamp_formatted: parameters.timestamp_formatted,
    }),
    ...(parameters.extensions !== undefined && {
      extensions: parameters.extensions,
    }),
  };
}

const IAD_EVENTS = [
  "HOME_ACCOUNT_TRACKER_ACCOUNT_DELETION_REQUESTED",
  "HOME_ACCOUNT_TRACKER_ACCOUNT_FIRST_PERIOD_ENTERED",
  "HOME_ACCOUNT_TRACKER_ACCOUNT_REACTIVATED",
  "HOME_ACCOUNT_TRACKER_ACCOUNT_SECOND_PERIOD_ENTERED",
  "HOME_ACCOUNT_TRACKER_NOTIFICATION_DELIVERY_PERMANENTLY_FAILED",
  "HOME_ACCOUNT_TRACKER_NOTIFICATION_SKIPPED",
  "HOME_ACCOUNT_TRACKER_NOTIFICATION_REQUESTED",
  "HOME_ACCOUNT_TRACKER_RECORD_DELETED"
]

/**
 * Builds a TxMA audit event from the given event name and parameters and sends
 * it to the TxMA audit queue.
 *
 * The target queue URL is read from the `TXMA_QUEUE_URL` environment variable.
 *
 * @param eventName - The name of the event to send.
 * @param parameters - The event-specific parameters used to build the event.
 * @returns The result of the SQS send message command.
 */
export async function sendAuditEvent(
  eventName: string,
  parameters: AuditEventParameters
): Promise<SendMessageCommandOutput | undefined> {
  if (IAD_EVENTS.includes(eventName) && !isSendIadAuditEventsEnabled()) {
    logger.info(`Skipping IAD event ${eventName} because IAD audit events are disabled`);
    return;
  }

  const queueUrl = getEnvironmentVariable("TXMA_QUEUE_URL");
  const event = buildTxmaEvent(eventName, parameters);

  try {
    const result = await sendSqsMessage(JSON.stringify(event), queueUrl);
    logger.info(
      `[Message sent to QUEUE] with message id = ${result.MessageId}`
    );
    return result;
  } catch (error: unknown) {
    logger.error(
      `Error occurred trying to send the audit event to the TxMA queue: ${(error as Error).message
      }`
    );
    throw error;
  }
}
