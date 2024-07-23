import {
  SQSClient,
  SendMessageRequest,
  SendMessageCommand,
  SendMessageCommandOutput,
} from "@aws-sdk/client-sqs";

export const sendSqsMessage = async (
  messageBody: string,
  queueUrl: string | undefined
): Promise<SendMessageCommandOutput> => {
  const { AWS_REGION } = process.env;
  if (!AWS_REGION) {
    throw new Error("AWS_REGION environment variable is not defined");
  }
  const client = new SQSClient({ region: AWS_REGION });
  const message: SendMessageRequest = {
    QueueUrl: queueUrl,
    MessageBody: messageBody,
  };
  return client.send(new SendMessageCommand(message));
};
