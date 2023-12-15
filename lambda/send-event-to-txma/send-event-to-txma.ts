import { SNSEvent } from "aws-lambda";
import {
  SendMessageCommand,
  SendMessageCommandOutput,
  SendMessageRequest,
  SQSClient,
} from "@aws-sdk/client-sqs";
import {CurrentTimeDescriptor, TxmaEvent} from "./models";
import {
  COMPONENT_ID,
  EventNamesEnum,
  REPORT_SUSPICIOUS_ACTIVITY_EVENT_NAME,
  ValidationRulesKeyEnum,
} from "./constants";
import VALIDATOR_RULES_MAP from "./validator-rules";
import validateObject from "./validator";

/**
 * A function for calculating and returning an object containing the current timestamp.
 *
 * @returns CurrentTimeDescriptor object, containing different formats of the current time
 */
export function getCurrentTimestamp(date = new Date()): CurrentTimeDescriptor {
  return {
    milliseconds: date.valueOf(),
    isoString: date.toISOString(),
    seconds: Math.floor(date.valueOf() / 1000),
  };
}
export const transformToTxMAEvent = (event: any, eventName: string): any => {
  let txmaEvent = null;
  const timestamps = getCurrentTimestamp();
  if (eventName === EventNamesEnum.HOME_REPORT_SUSPICIOUS_ACTIVITY) {
    txmaEvent = {
      timestamp: timestamps.seconds,
      event_timestamp_ms: timestamps.milliseconds,
      event_timestamp_ms_formatted: timestamps.isoString,
      component_id: COMPONENT_ID,
      event_name: REPORT_SUSPICIOUS_ACTIVITY_EVENT_NAME,
      user: {
        user_id: event.user_id,
        persistent_session_id: event.persistent_session_id,
        session_id: event.session_id,
      },
      extensions: {
        reported_session_id: event.reported_event.session_id,
      },
    };
  } else {
    throw new Error(
      "Unsupported event - There is no transformation logic for this event"
    );
  }
  return txmaEvent;
};

export const sendSqsMessage = async (
  messageBody: string,
  queueUrl: string | undefined
): Promise<SendMessageCommandOutput> => {
  const { AWS_REGION } = process.env;
  const client = new SQSClient({ region: AWS_REGION });
  const message: SendMessageRequest = {
    QueueUrl: queueUrl,
    MessageBody: messageBody,
  };
  return client.send(new SendMessageCommand(message));
};
/**
 * A function for sending an audit event message to the TxMA SQS queue.
 *
 * @param txmaEvent - the transformed txma event
 * @param queueUrl
 * @returns the response returned by the SQS client
 * @throws error
 * Thrown when an exception is thrown while trying to send a message to the queue
 */
export async function sendAuditEvent(
  txmaEvent: TxmaEvent,
  queueUrl: string | undefined
): Promise<SendMessageCommandOutput> {
  try {
    const result = await sendSqsMessage(JSON.stringify(txmaEvent), queueUrl);
    console.log(
      `[Message sent to QUEUE] with message id = ${result.MessageId}`
    );
    return result;
  } catch (error: any) {
    console.error(
      `Error occurred trying to send the audit event to the TxMA queue: ${error.message}`
    );
    throw error;
  }
}

export const handler = async (event: SNSEvent): Promise<void> => {
  const { DLQ_URL, EVENT_NAME, TXMA_QUEUE_URL } = process.env;
  await Promise.all(
    event.Records.map(async (record) => {
      try {
        if (!EVENT_NAME) {
          throw new Error(
            "Cannot handle event as event name has not been provided in the environment"
          );
        }
        const receivedEvent: any = JSON.parse(record.Sns.Message);

        if (
          !validateObject(receivedEvent, VALIDATOR_RULES_MAP.get(EVENT_NAME))
        ) {
          throw new Error(
            `Received Event: ${JSON.stringify(
              receivedEvent
            )} failed validation.`
          );
        }
        const txmaEvent = transformToTxMAEvent(receivedEvent, EVENT_NAME);
        if (
          !validateObject(
            txmaEvent,
            VALIDATOR_RULES_MAP.get(ValidationRulesKeyEnum.TXMA_EVENT)
          )
        ) {
          throw new Error(
            `Generated TXMA Event: ${JSON.stringify(
              txmaEvent
            )} failed validation.`
          );
        }
        await sendAuditEvent(txmaEvent, TXMA_QUEUE_URL);
      } catch (err: any) {
        const response = await sendSqsMessage(record.Sns.Message, DLQ_URL);
        console.error(
          `[Message sent to DLQ] with message id = ${response.MessageId}`,
          err
        );
      }
    })
  );
};
