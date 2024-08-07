import { SQSEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  PutCommandOutput,
} from "@aws-sdk/lib-dynamodb";
import { ActivityLogEntry, EncryptedActivityLogEntry } from "./common/model";
import encryptData from "./common/encrypt-data";
import { getEnvironmentVariable } from "./common/utils";

const dynamoDocClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const validateActivityLogEntry = (
  activityLogEntry: ActivityLogEntry
): void => {
  if (
    activityLogEntry.user_id === undefined ||
    activityLogEntry.session_id === undefined ||
    activityLogEntry.timestamp === undefined ||
    activityLogEntry.event_type === undefined ||
    activityLogEntry.event_id === undefined ||
    activityLogEntry.client_id === undefined ||
    activityLogEntry.reported_suspicious === undefined
  ) {
    throw new Error(
      `Activity log entry validation failed for event_id: ${activityLogEntry.event_id ?? null}`
    );
  }
};

export const writeActivityLogEntry = async (
  activityLogEntry: EncryptedActivityLogEntry
): Promise<PutCommandOutput> => {
  const TABLE_NAME = getEnvironmentVariable("TABLE_NAME");
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
  await Promise.all(
    event.Records.map(async (record) => {
      try {
        console.log(`Started processing message with ID: ${record.messageId}`);
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
        console.log(`Finished processing message with ID: ${record.messageId}`);
      } catch (error) {
        throw new Error(
          `Unable to write activity log for message with ID: ${record.messageId}, ${
            (error as Error).message
          }`
        );
      }
    })
  );
};
