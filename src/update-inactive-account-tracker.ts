import { Context, DynamoDBStreamEvent } from "aws-lambda";
import { AttributeValue, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { TxmaEvent } from "./common/model.js";
import { getEnvironmentVariable } from "./common/utils.js";
import { Logger } from "@aws-lambda-powertools/logger";
import type { InactiveAccountTrackerRecord } from "./common/model.ts";
import assert from 'node:assert/strict';

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
  const userNotificationsTableName = getEnvironmentVariable("USER_NOTIFICATIONS_TABLE_NAME");
  const olhClientId = getEnvironmentVariable("OLH_CLIENT_ID");

  for (const record of event.Records) {
    const txmaEvent = unmarshall(
      record.dynamodb?.NewImage?.event.M as Record<string, AttributeValue>
    ) as TxmaEvent;
    logger.info(`client_id: ${txmaEvent.client_id}`);

    const userId = txmaEvent.user?.user_id;

    if (!userId) {
      throw new Error("Missing user_id in event");
    }

    const response = await dynamoDocClient.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: "CommonSubjectIdIndex",
        KeyConditionExpression: "commonSubjectId = :uid",
        ExpressionAttributeValues: { ":uid": userId },
      })
    );

    assert(response.Items !== undefined, "Query response is missing Items");
    assert(response.Items.length < 2, `found more than one inactivity tracker record for ${userId}`)

    const currentTrackerRecord = response.Items.length > 0 ? response.Items[0] as InactiveAccountTrackerRecord : null;

    const eventDate = new Date(txmaEvent.timestamp * 1000);
    const trackerDate = currentTrackerRecord ? new Date(currentTrackerRecord.userLastActive) : new Date(0);

    const latestDate = eventDate > trackerDate ? eventDate : trackerDate;


    if (currentTrackerRecord?.status === 'deleting') {
      logger.warn(`AUTH_EVENT_ON_DELETED_ACCOUNT ${userId}`)
      return;
    }

    const newItem: InactiveAccountTrackerRecord = {
      commonSubjectId: userId,
      userLastActive: latestDate.toISOString(),
      dateForDeletion: latestDate.toISOString().split("T")[0],
      emailAddress: 'unknown',
      status: 'pending',
      statusLastUpdated: new Date().toISOString(),
    }

    const transactItems: { Put?: { TableName: string; Item: Record<string, unknown> }; Delete?: { TableName: string; Key: Record<string, unknown> } }[] = [
      { Put: { TableName: tableName, Item: newItem as unknown as Record<string, unknown> } },
    ];

    if (currentTrackerRecord) {
      transactItems.push({
        Delete: { TableName: tableName, Key: { dateForDeletion: currentTrackerRecord.dateForDeletion, commonSubjectId: userId } }
      });
    }


    if (txmaEvent.client_id !== olhClientId) {
      transactItems.push({
        Delete: {
          TableName: userNotificationsTableName,
          Key: { internalCommonSubjectId: userId },
        },
      });
    }

    try {
      await dynamoDocClient.send(new TransactWriteCommand({ TransactItems: transactItems }));
    } catch (error) {
      throw new Error(`Failed to update inactive account tracker for user ${userId} ${error}`, {
        cause: error
      });
    }
  }
};
