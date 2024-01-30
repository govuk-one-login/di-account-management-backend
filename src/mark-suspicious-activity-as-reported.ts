import { SNSEvent } from "aws-lambda";
import {
  SendMessageCommand,
  SendMessageCommandOutput,
  SendMessageRequest,
  SQSClient,
} from "@aws-sdk/client-sqs";
import { DynamoDBDocumentClient, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(dynamoClient);

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

export const getItemByEventId = async (tableName: string, indexName: string, eventId: string): Promise<{ user_id: string, timestamp: number }> => {
  const getItem = new QueryCommand({
    TableName: tableName,
    IndexName: indexName,
    KeyConditionExpression: "event_id = :event_id",
    ExpressionAttributeValues: {
      ":event_id": eventId
    }
  })

  const result = await dynamoDocClient.send(getItem)

  if (result?.Items?.length !== 1) {
    throw Error(`Expecting exactly 1 result from getItemByEventId, but got ${result?.Items?.length}`)
  }
  const item = result.Items[0]
  return { user_id: item.user_id, timestamp: item.timestamp }
}

export const markEventAsReported = async (tableName: string, user_id: string, timestamp: number) => {
  const command = new UpdateCommand({
    TableName: tableName,
    Key: {
      user_id,
      timestamp
    },
    UpdateExpression: "set reported_suspicious = :reported_suspicious",
    ExpressionAttributeValues: {
      ":reported_suspicious": true
    },
  })

  return dynamoDocClient.send(command)
}

export const handler = async (event: SNSEvent): Promise<void> => {
  const { DLQ_URL, TABLE_NAME, INDEX_NAME } = process.env;
  await Promise.all(
    event.Records.map(async (record) => {
      try {
        if (!TABLE_NAME) {
          throw new Error(
            "Cannot handle event as table name has not been provided in the environment"
          );
        }
        if (!INDEX_NAME) {
          throw new Error(
            "Cannot handle event as index name has not been provided in the environment"
          );
        }
        const receivedEvent: any = JSON.parse(record.Sns.Message);

        const { user_id, timestamp } = await getItemByEventId(TABLE_NAME, INDEX_NAME, receivedEvent.event_id)
        await markEventAsReported(TABLE_NAME, user_id, timestamp)

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
