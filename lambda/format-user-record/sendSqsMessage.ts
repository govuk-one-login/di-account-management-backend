import {
    SQSClient,
    SendMessageRequest,
    SendMessageCommand
  } from '@aws-sdk/client-sqs'
  
  const AWS_REGION = process.env.AWS_REGION;
  export const sendSqsMessage = async (
    messageBody: object,
    queueUrl: string
  ): Promise<string | undefined> => {
    const client = new SQSClient({ region: AWS_REGION})
    const message: SendMessageRequest = {
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(messageBody)
    }
    const result = await client.send(new SendMessageCommand(message))
    return result.MessageId
  }