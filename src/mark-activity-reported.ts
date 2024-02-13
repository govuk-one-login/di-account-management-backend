import { SNSEvent } from "aws-lambda";
import {
  SendMessageCommand,
  SendMessageCommandOutput,
  SendMessageRequest,
  SQSClient,
} from "@aws-sdk/client-sqs";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { ActivityLogEntry } from "./common/model";
import redact from "./common/redact";

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

export const markEventAsReported = async (
  tableName: string,
  user_id: string,
  event_id: string
) => {
  const command = new UpdateCommand({
    TableName: tableName,
    Key: {
      user_id,
      event_id,
    },
    UpdateExpression: "set reported_suspicious = :reported_suspicious",
    ExpressionAttributeValues: {
      ":reported_suspicious": true,
    },
  });

  return dynamoDocClient.send(command);
};

export const handler = async (event: SNSEvent): Promise<void> => {
  const { DLQ_URL, TABLE_NAME } = process.env;
  await Promise.all(
    event.Records.map(async (record) => {
      try {
        if (!TABLE_NAME) {
          throw new Error(
            "Cannot handle event as table name has not been provided in the environment"
          );
        }
        if (!DLQ_URL) {
          throw new Error(
            "Cannot handle event as DLQ url has not been provided in the environment"
          );
        }
        const receivedEvent: ActivityLogEntry = JSON.parse(record.Sns.Message);

        await markEventAsReported(
          TABLE_NAME,
          receivedEvent.user_id,
          receivedEvent.event_id
        );
      } catch (err) {
        console.error(
          "Error marking event as reported, sending to DLQ",
          redact(record.Sns.Message, ["user_id"])
        );
        const response = await sendSqsMessage(record.Sns.Message, DLQ_URL);
        console.error(
          `[Message sent to DLQ] with message id = ${response.MessageId}`,
          err as Error
        );
      }
    })
  );
};
