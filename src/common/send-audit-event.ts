import { SendMessageCommandOutput } from "@aws-sdk/client-sqs";
import { Logger } from "@aws-lambda-powertools/logger";
import { sendSqsMessage } from "./sqs.js";

const logger = new Logger();

/**
 * Sends an audit event to a queue (e.g. the TxMA audit queue).
 *
 * This is intentionally generic: it accepts any serialisable event object so it
 * can be reused for any audit event type, not just suspicious activity events.
 *
 * @param event - The audit event payload to send. Any JSON-serialisable object.
 * @param queueUrl - The URL of the target queue.
 * @returns The result of the SQS send message command.
 */
export async function sendAuditEvent<T>(
  event: T,
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

export default sendAuditEvent;
