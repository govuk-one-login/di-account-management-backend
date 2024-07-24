import { SNSEvent } from "aws-lambda";
import { ReportSuspiciousActivityStepInput } from "./common/model";
import { callAsyncStepFunction } from "./common/call-async-step-function";
import { sendSqsMessage } from "./common/sqs";

const validateReceivedEvent = (
  event: ReportSuspiciousActivityStepInput
): void => {
  if (
    event.event_id === undefined ||
    event.email === undefined ||
    event.persistent_session_id === undefined ||
    event.user_id === undefined
  ) {
    throw new Error(
      "Validation Failed - Required input to trigger report suspicious activity steps are not provided"
    );
  }
};

export const handler = async (event: SNSEvent): Promise<void> => {
  const { STATE_MACHINE_ARN, DLQ_URL } = process.env;
  await Promise.all(
    event.Records.map(async (record) => {
      try {
        console.log(
          `Started processing message with ID: ${record.Sns.MessageId}`
        );
        if (!STATE_MACHINE_ARN) {
          throw new Error(
            "STATE_MACHINE_ARN environment variable is not defined"
          );
        }
        if (!DLQ_URL) {
          throw new Error("DLQ_URL environment variable is not defined");
        }
        const messageBody = record.Sns.Message;
        const receivedEvent: ReportSuspiciousActivityStepInput =
          JSON.parse(messageBody);
        validateReceivedEvent(receivedEvent);

        await callAsyncStepFunction(STATE_MACHINE_ARN, receivedEvent);
        console.log(
          `Finished processing message with ID: ${record.Sns.MessageId}`
        );
      } catch (error) {
        console.error(`[Error occurred]: ${(error as Error).message}`);
        try {
          const result = await sendSqsMessage(record.Sns.Message, DLQ_URL);
          console.error(
            `[Message sent to DLQ] with message id = ${result.MessageId}`
          );
        } catch (dlqError) {
          console.error(`Failed to send message to DLQ: `, dlqError);
        }
      }
    })
  );
};
