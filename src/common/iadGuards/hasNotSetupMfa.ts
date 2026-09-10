import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getEnvironmentVariable } from "../utils.js";
import { Guard, Actions } from "../process-config.js";

const dynamoDocClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const hasNotSetupMfa: Guard = async (commonSubjectId) => {
  const inactiveAccountTrackerTableName = getEnvironmentVariable(
    "INACTIVE_ACCOUNT_TRACKER_TABLE_NAME"
  );
  const mfaQueryResponse = await dynamoDocClient.send(
    new QueryCommand({
      TableName: inactiveAccountTrackerTableName,
      IndexName: "CommonSubjectIdIndex",
      KeyConditionExpression: "commonSubjectId = :id",
      ExpressionAttributeValues: {
        ":id": commonSubjectId,
      },
    })
  );

  const recordItem = mfaQueryResponse.Items?.[0];
  // Skip notifications for accounts that have never set up MFA - these have not
  // been used to interact with a government service, so are treated as unusable.
  const continueAction = recordItem?.hasSetupMfa === false
    ? Actions.continueWithoutActions
    : Actions.continue;

  return { continue: continueAction, guardName: "hasNotSetupMfa" };
};
