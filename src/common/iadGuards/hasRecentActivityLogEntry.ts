import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getEnvironmentVariable } from "../utils.js";
import { Guard } from "../process-config.js";

const dynamoDocClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const FIVE_YEARS_MINUS_30_DAYS = 5 * 365 * 24 * 60 * 60 - 30 * 24 * 60 * 60;

export const hasRecentActivityLogEntry: Guard = async (commonSubjectId) => {
  const tableName = getEnvironmentVariable("ACTIVITY_LOG_TABLE_NAME");
  const cutoffTimestamp =
    Math.ceil(Date.now() / 1000) - FIVE_YEARS_MINUS_30_DAYS;
  const { Count } = await dynamoDocClient.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "user_id = :uid",
      FilterExpression: "#ts >= :cutoff",
      ExpressionAttributeNames: { "#ts": "timestamp" },
      ExpressionAttributeValues: {
        ":uid": commonSubjectId,
        ":cutoff": cutoffTimestamp,
      },
      Select: "COUNT",
    })
  );
  const guardActivated = (Count ?? 0) !== 0;
  return { guardActivated, guardName: "HomeUserActivityLog" };
};
