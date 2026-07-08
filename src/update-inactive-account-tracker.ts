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

type TransactionItems = ConstructorParameters<typeof TransactWriteCommand>[0]['TransactItems']

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

const getLatestDate = (txmaEvent: TxmaEvent, trackerRecord: InactiveAccountTrackerRecord | null) => {
  // if the timestamp on the audit event is older than the last active timestamp we have for the user
  // we should keep the existing date as it means the events have been receieved out of order
  const eventDate = new Date(txmaEvent.timestamp * 1000);
  const trackerDate = trackerRecord ? new Date(trackerRecord.userLastActive) : new Date(0);

  return eventDate > trackerDate ? eventDate : trackerDate;
}

const getDateForDeletion = (latestDate: Date): string => {
  const deletionDate = new Date(latestDate);
  deletionDate.setFullYear(deletionDate.getFullYear() + 5);
  return deletionDate.toISOString().split("T")[0];
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
    const latestDate = getLatestDate(txmaEvent, currentTrackerRecord);

    if (currentTrackerRecord?.status === 'deleting') {
      logger.warn(`AUTH_EVENT_ON_DELETING_ACCOUNT ${userId}`)
      return;
    }

    const newItem: InactiveAccountTrackerRecord = {
      commonSubjectId: userId,
      userLastActive: latestDate.toISOString(),
      dateForDeletion: getDateForDeletion(latestDate),
      emailAddress: 'unknown',
      status: 'pending',
      statusLastUpdated: new Date().toISOString(),
      source: "txma_audit_event",
      sourceId: txmaEvent.event_id,
    }

    const transactionItems: TransactionItems = [
      { Put: { TableName: tableName, Item: newItem as unknown as Record<string, unknown> } },
    ];

    if (currentTrackerRecord && currentTrackerRecord.dateForDeletion !== newItem.dateForDeletion) {
      // if the dates are the same, then we don't need to delete the old record as
      // it would have been updated in place by the Put command
      transactionItems.push({
        Delete: { TableName: tableName, Key: { dateForDeletion: currentTrackerRecord.dateForDeletion, commonSubjectId: userId } }
      });
    }

    if (txmaEvent.client_id !== olhClientId) {
      // if the user logs in to a different RP, then we won't show them the account kept notificaton
      // when they log in to Home
      transactionItems.push({
        Delete: {
          TableName: userNotificationsTableName,
          Key: { internalCommonSubjectId: userId },
        },
      });
    }

    try {
      await dynamoDocClient.send(new TransactWriteCommand({ TransactItems: transactionItems }));
    } catch (error) {
      throw new Error(`Failed to update inactive account tracker for user ${userId} ${error}`, {
        cause: error
      });
    }
  }
};
