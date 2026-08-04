import { Context, SQSEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  PutCommandOutput,
} from "@aws-sdk/lib-dynamodb";
import { ActivityLogEntry, EncryptedActivityLogEntry } from "./common/model.js";
import encryptData from "./common/encrypt-data.js";
import { getEnvironmentVariable } from "./common/utils.js";
import { Logger } from "@aws-lambda-powertools/logger";

const dynamoDocClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const logger = new Logger();

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
    Item: { ...activityLogEntry },
  });
  return dynamoDocClient.send(command);
};

export const handler = async (
  event: SQSEvent,
  context: Context
): Promise<void> => {
  logger.addContext(context);

  logger.info("DEBUG write-activity-log: handler invoked", {
    recordCount: event.Records.length,
  });

  await Promise.all(
    event.Records.map(async (record) => {
      try {
        const activityLogEntry: ActivityLogEntry = JSON.parse(record.body);

        logger.info("DEBUG write-activity-log: processing record", {
          event_id: activityLogEntry.event_id,
          user_id: activityLogEntry.user_id,
          event_type: activityLogEntry.event_type,
          session_id: activityLogEntry.session_id,
          client_id: activityLogEntry.client_id,
        });

        validateActivityLogEntry(activityLogEntry);

        logger.info("DEBUG write-activity-log: validation passed, encrypting", {
          event_id: activityLogEntry.event_id,
          user_id: activityLogEntry.user_id,
        });

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

        logger.info("DEBUG write-activity-log: written to DynamoDB", {
          event_id: activityLogEntry.event_id,
          user_id: activityLogEntry.user_id,
        });
      } catch (error) {
        throw new Error(
          `Unable to write activity log for message with ID: ${record.messageId}, ${
            (error as Error).message
          }`, { cause: error }
        );
      }
    })
  );
};
