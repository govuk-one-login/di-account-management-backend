import { SNSEvent } from "aws-lambda";
import { MarkActivityAsReportedInput } from "./common/model";
import { callAsyncStepFunction } from "./common/call-async-step-function";
import {
  SendMessageCommand,
  SendMessageRequest,
  SQSClient,
} from "@aws-sdk/client-sqs";

export const handler = async (event: SNSEvent): Promise<void> => {
  const { STATE_MACHINE_ARN, DLQ_URL } = process.env;
  await Promise.all(
    event.Records.map(async (record) => {
      try {
        if (!STATE_MACHINE_ARN || !DLQ_URL) {
          throw new Error(
            "Error Occurred - Required environment variables to trigger report suspicious activity steps are not provided"
          );
        }
        const receivedEvent: MarkActivityAsReportedInput = JSON.parse(
          record.Sns.Message
        );
        if (
          receivedEvent.event_id === undefined ||
          receivedEvent.email === undefined ||
          receivedEvent.persistent_session_id === undefined ||
          receivedEvent.user_id === undefined
        ) {
          throw new Error(
            "Validation Failed - Required input to trigger report suspicious activity steps are not provided"
          );
        }
        await callAsyncStepFunction(STATE_MACHINE_ARN, receivedEvent);
      } catch (error: unknown) {
        console.error(
          `[Error occurred], trigger report suspicious activity step function:, ${
            (error as Error).message
          }`
        );
        const { AWS_REGION } = process.env;
        const client = new SQSClient({ region: AWS_REGION });
        const message: SendMessageRequest = {
          QueueUrl: DLQ_URL,
          MessageBody: record.Sns.Message,
        };
        const result = await client.send(new SendMessageCommand(message));
        console.error(
          `[Message sent to DLQ] with message id = ${result.MessageId}`,
          error
        );
      }
    })
  );
};
