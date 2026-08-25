import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getEnvironmentVariable } from "../utils.js";
import { Guard, Actions } from "../process-config.js";

const dynamoDocClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const hasUndeliverableEmailAddress: Guard = async (commonSubjectId) => {
  const inactiveAccountTrackerTableName = getEnvironmentVariable(
    "INACTIVE_ACCOUNT_TRACKER_TABLE_NAME"
  );
  const emailQueryResponse = await dynamoDocClient.send(
    new QueryCommand({
      TableName: inactiveAccountTrackerTableName,
      IndexName: "CommonSubjectIdIndex",
      KeyConditionExpression: "commonSubjectId = :id",
      ExpressionAttributeValues: {
          ":id": commonSubjectId
      }
    })
  );

  const recordItem = emailQueryResponse.Items?.[0];
  const continueAction = recordItem?.hasUndeliverableEmailAddress ? Actions.continueWithoutActions : Actions.continue;
  
  return { continue: continueAction, guardName: "undeliverableEmailAddress" };
};
