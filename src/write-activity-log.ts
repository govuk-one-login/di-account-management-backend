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
import { ActivityLogEntry, EncryptedActivityLogEntry } from "./common/model";
import encryptData from "./common/encrypt-data";

const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(dynamoClient);
const sqsClient = new SQSClient({});

export const validateActivityLogEntry = (
  activityLogEntry: ActivityLogEntry,
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
  activityLogEntry: EncryptedActivityLogEntry,
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

  for await (const record of event.Records) {
    try {
      const activityLogEntry: ActivityLogEntry = JSON.parse(record.body);

      try {
        validateActivityLogEntry(activityLogEntry);
      } catch (e) {
        console.error(`[Activity Log Entry Validation Error]`, e);
        throw e;
      }

      let encryptedEventType;
      try {
        encryptedEventType = await encryptData(
          activityLogEntry.event_type,
          activityLogEntry.user_id,
        );
      } catch (e) {
        console.error(`[Event-type Encryption Error]`, e);
        throw e;
      }

      const encryptedActivityLog: EncryptedActivityLogEntry = {
        event_id: activityLogEntry.event_id,
        event_type: encryptedEventType,
        session_id: activityLogEntry.session_id,
        user_id: activityLogEntry.user_id,
        timestamp: activityLogEntry.timestamp,
        client_id: activityLogEntry.client_id,
        reported_suspicious: activityLogEntry.reported_suspicious,
      };

      try {
        await writeActivityLogEntry(encryptedActivityLog);
      } catch (e) {
        console.error(`[Error Writing Activity Log Entry]`, e);
        throw e;
      }
    } catch (err) {
      const message: SendMessageRequest = {
        QueueUrl: DLQ_URL,
        MessageBody: record.body,
      };

      let result;
      try {
        result = await sqsClient.send(new SendMessageCommand(message));
      } catch (e) {
        console.error(`[Error Sending Message to DLQ]`, e);
        return;
      }

      console.error(
        `[Message sent to DLQ] with message id = ${result.MessageId}`,
        err,
      );
    }
  }
};
