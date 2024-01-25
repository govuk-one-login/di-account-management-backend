import { SQSEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  PutCommandOutput,
} from "@aws-sdk/lib-dynamodb";
import {
  SendMessageCommand,
  SendMessageRequest,
  SQSClient,
} from "@aws-sdk/client-sqs";
import { ActivityLogEntry, EncryptedActivityLogEntry } from "./models";
import encryptData from "./encrypt-data";

const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(dynamoClient);
const sqsClient = new SQSClient({});

export const validateActivityLogEntry = (
  activityLogEntry: ActivityLogEntry
): void => {
  if (
    !(
      activityLogEntry.user_id !== undefined &&
      activityLogEntry.session_id !== undefined &&
      activityLogEntry.timestamp !== undefined &&
      activityLogEntry.event_type !== undefined &&
      activityLogEntry.event_id !== undefined &&
      activityLogEntry.client_id !== undefined &&
      activityLogEntry.reported_suspicious !== undefined
    )
  ) {
    throw new Error(`Could not validate activity log entry`);
  }
};

export const writeActivityLogEntry = async (
  activityLogEntry: EncryptedActivityLogEntry
): Promise<PutCommandOutput> => {
  const { TABLE_NAME } = process.env;
  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      user_id: activityLogEntry.user_id,
      timestamp: activityLogEntry.timestamp,
      session_id: activityLogEntry.session_id,
      event_type: activityLogEntry.event_type,
      event_id: activityLogEntry.event_id,
      client_id: activityLogEntry.client_id,
      reported_suspicious: activityLogEntry.reported_suspicious,
    },
  });
  return dynamoDocClient.send(command);
};

export const handler = async (event: SQSEvent): Promise<void> => {
  const { DLQ_URL } = process.env;
  await Promise.all(
    event.Records.map(async (record) => {
      try {
        const activityLogEntry: ActivityLogEntry = JSON.parse(record.body);
        validateActivityLogEntry(activityLogEntry);
        const encryptedActivityLog: EncryptedActivityLogEntry = {
          event_id: activityLogEntry.event_id,
          event_type: await encryptData(
            activityLogEntry.event_type,
            activityLogEntry.user_id
          ),
          session_id: activityLogEntry.session_id,
          user_id: activityLogEntry.user_id,
          timestamp: activityLogEntry.timestamp,
          client_id: activityLogEntry.client_id,
          reported_suspicious: activityLogEntry.reported_suspicious,
        };
        await writeActivityLogEntry(encryptedActivityLog);
      } catch (err) {
        const message: SendMessageRequest = {
          QueueUrl: DLQ_URL,
          MessageBody: record.body,
        };
        const result = await sqsClient.send(new SendMessageCommand(message));
        console.error(
          `[Message sent to DLQ] with message id = ${result.MessageId}`,
          err
        );
      }
    })
  );
};
