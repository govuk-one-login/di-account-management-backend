import { SQSEvent } from "aws-lambda";
import {
  SendMessageCommand,
  SendMessageCommandOutput,
  SendMessageRequest,
  SQSClient,
} from "@aws-sdk/client-sqs";
import { TxmaEvent } from "./models";
import {
  COMPONENT_ID,
  EventNamesEnum,
  REPORT_SUSPICIOUS_ACTIVITY_EVENT_NAME,
  ValidationRulesKeyEnum,
} from "./constants";
import VALIDATOR_RULES_MAP from "./validator-rules";

export const transformToTxMAEvent = (
  suspiciousEvent: any,
  eventName: string
): any => {
  let txmaEvent = null;
  if (eventName === EventNamesEnum.HOME_REPORT_SUSPICIOUS_ACTIVITY) {
    txmaEvent = {
      event_timestamp_ms: new Date().valueOf(),
      component_id: COMPONENT_ID,
      event_name: REPORT_SUSPICIOUS_ACTIVITY_EVENT_NAME,
      user: {
        user_id: suspiciousEvent.user_id,
        persistent_session_id: suspiciousEvent.persistent_session_id,
        session_id: suspiciousEvent.session_id,
      },
      extensions: {
        reported_session_id: suspiciousEvent.reported_event.session_id,
      },
    };
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
 * @returns the response returned by the SQS client
 * @throws error
 * Thrown when an exception is thrown while trying to send a message to the queue
 */
export async function sendAuditEvent(
  txmaEvent: TxmaEvent
): Promise<SendMessageCommandOutput> {
  const { TXMA_QUEUE_URL } = process.env;

  try {
    return await sendSqsMessage(JSON.stringify(txmaEvent), TXMA_QUEUE_URL);
  } catch (error: unknown) {
    console.error(
      `Error occurred trying to send the audit event to the TxMA queue: ${JSON.stringify(
        error
      )}`
    );
    throw error;
  }
}

export const handler = async (event: SQSEvent): Promise<void> => {
  const { DLQ_URL, EVENT_NAME } = process.env;
  await Promise.all(
    event.Records.map(async (record: { body: string }) => {
      try {
        if (!EVENT_NAME) {
          throw new Error(
            "Event name must be provided as an environment variable"
          );
        }
        const receivedEvent: any = JSON.parse(record.body);

        if (
          validateObject(receivedEvent, VALIDATOR_RULES_MAP.get(EVENT_NAME))
        ) {
          const txmaEvent = transformToTxMAEvent(receivedEvent, EVENT_NAME);
          if (
            validateObject(
              txmaEvent,
              VALIDATOR_RULES_MAP.get(ValidationRulesKeyEnum.TXMA_EVENT)
            )
          ) {
            await sendAuditEvent(txmaEvent);
          } else {
            throw new Error(
              `Generated TXMA Event: ${JSON.stringify(
                txmaEvent
              )} failed validation.`
            );
          }
        } else {
          throw new Error(
            `Received Event: ${JSON.stringify(
              receivedEvent
            )} failed validation.`
          );
        }
      } catch (err) {
        const response = await sendSqsMessage(record.body, DLQ_URL);
        console.error(
          `[Message sent to DLQ] with message id = ${response.MessageId}`,
          err
        );
      }
    })
  );
};
