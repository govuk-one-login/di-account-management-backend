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
import {
  Activity,
  ActivityLogEntry,
  EncryptedActivityLogEntry,
} from "./models";
import encryptData from "./encrypt-data";

const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(dynamoClient);
const sqsClient = new SQSClient({});

const validateActivity = (activity: Activity): boolean => {
  return (
    activity.client_id !== undefined &&
    activity.timestamp !== undefined &&
    activity.type !== undefined &&
    activity.event_id !== undefined
  );
};

export const validateActivityLogEntry = (
  activityLogEntry: ActivityLogEntry
): void => {
  if (
    !(
      activityLogEntry.user_id !== undefined &&
      activityLogEntry.session_id !== undefined &&
      activityLogEntry.timestamp !== undefined &&
      activityLogEntry.truncated !== undefined &&
      activityLogEntry.event_type !== undefined &&
      activityLogEntry.activities !== undefined &&
      activityLogEntry.activities.every(validateActivity)
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
      activities: activityLogEntry.activities,
      event_type: activityLogEntry.event_type,
      truncated: activityLogEntry.truncated,
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
        const encryptedActivities: string = await encryptData(
          activityLogEntry.activities,
          activityLogEntry.user_id
        );
        const encryptedActivityLog: EncryptedActivityLogEntry = {
          event_type: activityLogEntry.event_type,
          session_id: activityLogEntry.session_id,
          user_id: activityLogEntry.user_id,
          timestamp: activityLogEntry.timestamp,
          activities: encryptedActivities,
          truncated: activityLogEntry.truncated,
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
