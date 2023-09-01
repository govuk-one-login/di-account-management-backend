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
        console.log(`enter handler`);
        const activityLogEntry: ActivityLogEntry = JSON.parse(record.body);
        console.log(
          `activity log user_id: ${activityLogEntry.user_id} extracted from the SQS event`
        );
        validateActivityLogEntry(activityLogEntry);
        console.log(
          `activity log user_id: ${activityLogEntry.user_id} validated`
        );
        const encryptedActivities: string = await encryptData(
          JSON.stringify(activityLogEntry.activities),
          activityLogEntry.user_id
        );
        console.log(
          `handler has got encrypted response for: ${activityLogEntry.user_id}`
        );
        const encryptedActivityLog: EncryptedActivityLogEntry = {
          event_type: activityLogEntry.event_type,
          session_id: activityLogEntry.session_id,
          user_id: activityLogEntry.user_id,
          timestamp: activityLogEntry.timestamp,
          activities: encryptedActivities,
          truncated: activityLogEntry.truncated,
        };
        console.log(
          `handler will call write function for: ${activityLogEntry.user_id}`
        );
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
