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
import { Activity, ActivityLogEntry } from "../shared/models";


export const validateActivityLogEntries = (activityLogEntries: ActivityLogEntry[]): void => {
    for (let i = 0; i < activityLogEntries.length; i += 1) {
        const activityLog = activityLogEntries[i];
        if (!(
                activityLog.user_id  !== undefined &&
                activityLog.session_id !== undefined &&
                activityLog.timestamp !== undefined &&
                activityLog.truncated !== undefined
            )) {
            throw new Error(`Could not validate activity log entry ${JSON.stringify(activityLog)}`);
        }
    }
};

export const validateActivities = (activities: Activity[]): void => {
    for (let i = 0; i < activities.length; i += 1) {
        const activity = activities[i]
        if (!(
            // assume client_id always present?
            activity.client_id !== undefined &&
            /// should be >0 ? 
            activity.timestamp !== undefined &&
            // enum ?
            activity.type !== undefined
        )) {
        throw new Error(`Could not validate activity log entry ${JSON.stringify(activity)}`);
    }
    }
}

export const writeActivityLogEntry = async (activityLogEntry: ActivityLogEntry):
 Promise<PutCommandOutput> => {
    const { TABLE_NAME } = process.env;
    const command = new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        
        //TODO

        user_id: userServices.user_id,
        services: userServices.services,
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
          validateActivityLogEntries(activityLogEntry);
          await writeActivityLogEntry(activityLogEntry);
        } catch (err) {
          console.error(err);
          const message: SendMessageRequest = {
            QueueUrl: DLQ_URL,
            MessageBody: record.body,
          };
          await sqsClient.send(new SendMessageCommand(message));
        }
      })
    );
  };