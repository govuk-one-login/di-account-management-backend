import {
  SQSClient,
  SendMessageRequest,
  SendMessageCommand,
  SendMessageCommandOutput,
} from "@aws-sdk/client-sqs";
import { getEnvironmentVariable } from "./utils";

export const sendSqsMessage = async (
  messageBody: string,
  queueUrl: string | undefined
): Promise<SendMessageCommandOutput> => {
  const AWS_REGION = getEnvironmentVariable("AWS_REGION");
  const client = new SQSClient({ region: AWS_REGION });
  const message: SendMessageRequest = {
    QueueUrl: queueUrl,
    MessageBody: messageBody,
  };
  return client.send(new SendMessageCommand(message));
};
