import { SendMessageCommandOutput } from "@aws-sdk/client-sqs";
import { ReportSuspiciousActivityEvent, TxMAAuditEvent } from "./common/model";
import {
  COMPONENT_ID,
  EventNamesEnum,
  ValidationRulesKeyEnum,
} from "./common/constants";
import VALIDATOR_RULES_MAP from "./common/validator-rules";
import validateObject from "./common/validator";
import { sendSqsMessage } from "./common/sqs";
import { getEnvironmentVariable } from "./common/utils";
import { Logger } from "@aws-lambda-powertools/logger";
import { Context } from "aws-lambda";

const logger = new Logger();

export const transformToTxMAEvent = (
  event: ReportSuspiciousActivityEvent,
  eventName: string
): TxMAAuditEvent => {
  if (
    !event.event_timestamp_ms ||
    !event.component_id ||
    !event.event_timestamp_ms_formatted ||
    !event.zendesk_ticket_id ||
    !event.notify_message_id ||
    !event.suspicious_activity
  ) {
    throw Error(
      "Error generating TxMA event, required fields are not provided"
    );
  }
  let txmaEvent = null;
  if (eventName === EventNamesEnum.HOME_REPORT_SUSPICIOUS_ACTIVITY) {
    txmaEvent = {
      user: {
        user_id: event.suspicious_activity.user_id,
        persistent_session_id: event.persistent_session_id,
        session_id: event.session_id,
      },
      component_id: event.component_id,
      event_name: event.event_type,
      timestamp: event.timestamp,
      event_timestamp_ms: event.event_timestamp_ms,
      event_timestamp_ms_formatted: event.event_timestamp_ms_formatted,
      extensions: {
        zendesk_ticket_number: event.zendesk_ticket_id,
        notify_reference: event.notify_message_id,
        suspicious_activities: [
          {
            event_id: event.suspicious_activity.event_id,
            event_type: event.suspicious_activity.event_type,
            session_id: event.suspicious_activity.session_id,
            timestamp: event.suspicious_activity.timestamp,
            client_id: event.suspicious_activity.client_id,
          },
        ],
      },
      ...(event.device_information !== undefined
        ? {
            restricted: {
              device_information: { encoded: event.device_information },
            },
          }
        : {}),
    };
  } else {
    throw new Error(
      "Unsupported event - There is no transformation logic for this event"
    );
  }
  return txmaEvent;
};

export async function sendAuditEvent(
  event: TxMAAuditEvent,
  queueUrl: string | undefined
): Promise<SendMessageCommandOutput> {
  try {
    const result = await sendSqsMessage(JSON.stringify(event), queueUrl);
    logger.info(
      `[Message sent to QUEUE] with message id = ${result.MessageId}`
    );
    return result;
  } catch (error: unknown) {
    logger.error(
      `Error occurred trying to send the audit event to the TxMA queue: ${
        (error as Error).message
      }`
    );
    throw error;
  }
}

export const handler = async (
  input: ReportSuspiciousActivityEvent,
  context: Context
): Promise<void> => {
  logger.addContext(context);
  const EVENT_NAME = getEnvironmentVariable("EVENT_NAME");
  const TXMA_QUEUE_URL = getEnvironmentVariable("TXMA_QUEUE_URL");
  try {
    if (!validateObject(input, VALIDATOR_RULES_MAP.get(EVENT_NAME))) {
      throw new Error(
        `Received Event: ${JSON.stringify(input)} failed validation.`
      );
    }
    input.component_id = COMPONENT_ID;
    const txMAEvent = transformToTxMAEvent(
      input,
      EventNamesEnum.HOME_REPORT_SUSPICIOUS_ACTIVITY
    );
    if (
      !validateObject(
        txMAEvent,
        VALIDATOR_RULES_MAP.get(ValidationRulesKeyEnum.TXMA_EVENT)
      )
    ) {
      throw new Error(
        `TXMA Event: ${JSON.stringify(input)} failed validation.`
      );
    }
    await sendAuditEvent(txMAEvent, TXMA_QUEUE_URL);
  } catch (err: unknown) {
    throw new Error(
      `Error occurred sending event to TxMA: ${(err as Error).message}`
    );
  }
};
