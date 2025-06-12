import {
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  ActivityLogEntry,
  ReportSuspiciousActivityStepInput,
  ReportSuspiciousActivityEvent,
} from "./common/model";
import crypto from "crypto";
import { COMPONENT_ID, EventNamesEnum } from "./common/constants";
import { getCurrentTimestamp, getEnvironmentVariable } from "./common/utils";
import { decryptData } from "./decrypt-data";
import redact from "./common/redact";
import { Logger } from "@aws-lambda-powertools/logger";
import { Context } from "aws-lambda";

const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(dynamoClient);
const logger = new Logger();

export const markEventAsReported = async (
  tableName: string,
  user_id: string,
  event_id: string,
  reported_suspicious_time: number
) => {
  const command = new UpdateCommand({
    TableName: tableName,
    Key: {
      user_id,
      event_id,
    },
    UpdateExpression:
      "set reported_suspicious = :reported_suspicious, reported_suspicious_time = :reported_suspicious_time",
    ExpressionAttributeValues: {
      ":reported_suspicious": true,
      ":reported_suspicious_time": reported_suspicious_time,
    },
  });

  return dynamoDocClient.send(command);
};

export const decryptEventType = async (
  userId: string,
  encrypted: ActivityLogEntry,
  generatorKeyArn: string,
  wrappingKeyArn: string
): Promise<string> => {
  if (!encrypted) {
    return "";
  }
  return await decryptData(
    encrypted.event_type,
    userId,
    generatorKeyArn,
    wrappingKeyArn
  );
};

export const queryActivityLog = async (
  userId: string,
  eventId: string
): Promise<ActivityLogEntry | undefined> => {
  try {
    const ACTIVITY_LOG_TABLE_NAME = getEnvironmentVariable(
      "ACTIVITY_LOG_TABLE_NAME"
    );
    const command = {
      TableName: ACTIVITY_LOG_TABLE_NAME,
      KeyConditionExpression: "user_id = :user_id and event_id = :event_id",
      ExpressionAttributeValues: {
        ":user_id": userId,
        ":event_id": eventId,
      },
    };
    const response = await dynamoDocClient.send(new QueryCommand(command));
    return response.Items ? (response.Items[0] as ActivityLogEntry) : undefined;
  } catch (error) {
    throw Error(
      `Error querying activity log with user_id: ${userId} 
      and timestamp_group_id: ${eventId} Error is: ${(error as Error).message}`
    );
  }
};

export const handler = async (
  input: ReportSuspiciousActivityStepInput,
  context: Context
): Promise<ReportSuspiciousActivityEvent> => {
  logger.addContext(context);
  const activityLog = await queryActivityLog(input.user_id, input.event_id);
  const event_id = `${crypto.randomUUID()}`;
  const timestamps = getCurrentTimestamp();
  if (activityLog) {
    try {
      const ACTIVITY_LOG_TABLE_NAME = getEnvironmentVariable(
        "ACTIVITY_LOG_TABLE_NAME"
      );
      const GENERATOR_KEY_ARN = getEnvironmentVariable("GENERATOR_KEY_ARN");
      const WRAPPING_KEY_ARN = getEnvironmentVariable("WRAPPING_KEY_ARN");

      await markEventAsReported(
        ACTIVITY_LOG_TABLE_NAME,
        activityLog.user_id,
        activityLog.event_id,
        input.reported_suspicious_time
      );
      activityLog.reported_suspicious = true;
      activityLog.event_type = await decryptEventType(
        input.user_id,
        activityLog,
        GENERATOR_KEY_ARN,
        WRAPPING_KEY_ARN
      );
    } catch (err) {
      logger.error(
        `Error marking event as reported, error message is: ${
          (err as Error).message
        }`,
        redact(JSON.stringify(activityLog), ["user_id"])
      );
      throw new Error(
        "Error occurred in marking event as reported: " + (err as Error).message
      );
    }
  } else {
    throw new Error(
      `No activity log exist in DB for with user_id : ${input.user_id} " +
        and event id: ${input.event_id}`
    );
  }

  const reportedEvent: ReportSuspiciousActivityEvent = {
    persistent_session_id: input.persistent_session_id,
    session_id: input.session_id,
    event_id,
    event_type: EventNamesEnum.HOME_REPORT_SUSPICIOUS_ACTIVITY,
    email_address: input.email,
    component_id: COMPONENT_ID,
    timestamp: timestamps.seconds,
    event_timestamp_ms: timestamps.milliseconds,
    event_timestamp_ms_formatted: timestamps.isoString,
    suspicious_activity: activityLog,
  };
  if (input.device_information) {
    reportedEvent.device_information = input.device_information;
  }
  return reportedEvent;
};
