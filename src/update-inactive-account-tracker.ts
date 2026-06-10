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

const getCurrentRecordForUser = async (userId: string, tableName: string): Promise<InactiveAccountTrackerRecord | null> => {
  const response = await dynamoDocClient.send(
    new QueryCommand({
      IndexName: "CommonSubjectIdIndex",
      TableName: tableName,
      KeyConditionExpression: "commonSubjectId = :uid",
      ExpressionAttributeValues: { ":uid": userId },
    })
  );

  assert(response.Items !== undefined, "Query response is missing Items");
  assert(response.Items.length < 2, `found more than one inactivity tracker record for ${userId}`)

  return response.Items.length > 0 ? response.Items[0] as InactiveAccountTrackerRecord : null;
}

const getDateForDeletion = (txmaEvent: TxmaEvent, trackerRecord: InactiveAccountTrackerRecord | null) => {
  const eventDate = new Date(txmaEvent.timestamp * 1000);
  const trackerDate = trackerRecord ? new Date(trackerRecord.userLastActive) : new Date(0);

  return eventDate > trackerDate ? eventDate : trackerDate;
}

export const handler = async (
  event: DynamoDBStreamEvent,
  context: Context
): Promise<void> => {
  logger.addContext(context);

  const tableName = getEnvironmentVariable("INACTIVE_ACCOUNT_TRACKER_TABLE_NAME");
  const userNotificationsTableName = getEnvironmentVariable("USER_NOTIFICATIONS_TABLE_NAME");
  const olhClientId = getEnvironmentVariable("OLH_CLIENT_ID");

  for (const record of event.Records) {
    const txmaEvent = unmarshall(
      record.dynamodb?.NewImage?.event.M as Record<string, AttributeValue>
    ) as TxmaEvent;

    const userId = txmaEvent.user?.user_id;
    assert(userId !== undefined, "user_id is undefined in the event");

    const currentTrackerRecord = await getCurrentRecordForUser(userId, tableName);
    const latestDate = getDateForDeletion(txmaEvent, currentTrackerRecord);

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

    if (currentTrackerRecord && currentTrackerRecord.dateForDeletion !== newItem.dateForDeletion) {
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
