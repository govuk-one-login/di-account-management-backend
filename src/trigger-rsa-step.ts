import { Context, SNSEvent } from "aws-lambda";
import { ReportSuspiciousActivityStepInput } from "./common/model";
import { callAsyncStepFunction } from "./common/call-async-step-function";
import { getEnvironmentVariable } from "./common/utils";
import { Logger } from "@aws-lambda-powertools/logger";

const logger = new Logger();

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

export const handler = async (
  event: SNSEvent,
  context: Context
): Promise<void> => {
  logger.addContext(context);
  const STATE_MACHINE_ARN = getEnvironmentVariable("STATE_MACHINE_ARN");
  await Promise.all(
    event.Records.map(async (record) => {
      try {
        logger.info(
          `Started processing message with ID: ${record.Sns.MessageId}`
        );
        const messageBody = record.Sns.Message;
        const receivedEvent: ReportSuspiciousActivityStepInput =
          JSON.parse(messageBody);
        validateReceivedEvent(receivedEvent);
        await callAsyncStepFunction(STATE_MACHINE_ARN, receivedEvent);
        logger.info(
          `Finished processing message with ID: ${record.Sns.MessageId}`
        );
      } catch (error) {
        throw new Error(
          `Unable to trigger rsa step for message with ID: ${record.Sns.MessageId}, ${
            (error as Error).message
          }`
        );
      }
    })
  );
};
