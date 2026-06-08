import { Context, DynamoDBStreamEvent } from "aws-lambda";
import { AttributeValue } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { TxmaEvent } from "./common/model.js";
import { getEnvironmentVariable } from "./common/utils.js";
import { Logger } from "@aws-lambda-powertools/logger";

const logger = new Logger();
const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(dynamoClient);

export const handler = async (
  event: DynamoDBStreamEvent,
  context: Context
): Promise<void> => {
  logger.addContext(context);
  logger.info("UpdateInactiveAccountTracker invoked");

  const tableName = getEnvironmentVariable("INACTIVE_ACCOUNT_TRACKER_TABLE_NAME");

  for (const record of event.Records) {
    const txmaEvent = unmarshall(
      record.dynamodb?.NewImage?.event.M as Record<string, AttributeValue>
    ) as TxmaEvent;
    logger.info(`client_id: ${txmaEvent.client_id}`);

    const userId = txmaEvent.user?.user_id;
    if (userId) {
      const response = await dynamoDocClient.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: "CommonSubjectIdIndex",
          KeyConditionExpression: "commonSubjectId = :uid",
          ExpressionAttributeValues: { ":uid": userId },
        })
      );

      if (response.Items && response.Items.length > 0) {
        console.log(response.Items[0].dateForDeletion);
      }
    }
  }
};
