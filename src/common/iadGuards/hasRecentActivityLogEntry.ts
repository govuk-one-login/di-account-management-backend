import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getEnvironmentVariable } from "../utils.js";
import { Guard, Actions } from "../process-config.js";

const dynamoDocClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const FIVE_YEARS_MINUS_30_DAYS_MS =
  (5 * 365 * 24 * 60 * 60 - 30 * 24 * 60 * 60) * 1000;

export const hasRecentActivityLogEntry: Guard = async (commonSubjectId) => {
  const tableName = getEnvironmentVariable("ACTIVITY_LOG_TABLE_NAME");
  const cutoffTimestamp = Date.now() - FIVE_YEARS_MINUS_30_DAYS_MS;
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
  const continueAction = (Count ?? 0) === 0 ? Actions.continue : Actions.abort;
  return { continue: continueAction, guardName: "HomeUserActivityLog" };
};
