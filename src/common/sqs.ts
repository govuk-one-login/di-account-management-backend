import { SQSClient, SendMessageRequest } from "@aws-sdk/client-sqs";
import {
  SendMessageCommand,
  SendMessageCommandOutput,
} from "@aws-sdk/client-sqs/dist-types/commands/SendMessageCommand";

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
