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
  assert(response.Items.length < 2, `found more than one inactivity tracker record for ${userId}`);

  return response.Items.length > 0 ? response.Items[0] as InactiveAccountTrackerRecord : null;
};

const getEventDate = (txmaEvent: TxmaEvent): Date => {
  // Use explicit millisecond timestamp if available
  if (txmaEvent.event_timestamp_ms) {
    return new Date(txmaEvent.event_timestamp_ms);
  }

  let timestamp = txmaEvent.timestamp;

  // some txma events timestamps are in milliseconds when they should be in seconds.
  // if the timestamp is over 13 digits it is essentially guaranteed to be in milliseconds. 
  // 13 digit millisecond timestamps started 9 September 2001.
  if (timestamp.toString().length >= 13) {
    timestamp = Math.floor(timestamp / 1000);
  }

  return new Date(timestamp * 1000);
};

const getLatestDate = (eventDate: Date, trackerRecord: InactiveAccountTrackerRecord | null): Date => {
  const trackerDate = trackerRecord ? new Date(trackerRecord.userLastActive) : new Date(0);
  return eventDate > trackerDate ? eventDate : trackerDate;
};

const getDateForDeletion = (latestDate: Date): string => {
  const deletionDate = new Date(latestDate);
  deletionDate.setFullYear(deletionDate.getFullYear() + 5);
  return deletionDate.toISOString().split("T")[0];
};

const buildTransactionItems = (
  tableName: string,
  userNotificationsTableName: string,
  olhClientId: string,
  userId: string,
  newItem: InactiveAccountTrackerRecord,
  currentTrackerRecord: InactiveAccountTrackerRecord | null,
  txmaEvent: TxmaEvent
): TransactionItems => {
  const items: TransactionItems = [
    { Put: { TableName: tableName, Item: newItem as unknown as Record<string, unknown> } },
  ];

  if (currentTrackerRecord && currentTrackerRecord.dateForDeletion !== newItem.dateForDeletion) {
    // if the dates are the same, then we don't need to delete the old record as
    // it would have been updated in place by the Put command
    items.push({
      Delete: { TableName: tableName, Key: { dateForDeletion: currentTrackerRecord.dateForDeletion, commonSubjectId: userId } }
    });
  }

  if (txmaEvent.client_id !== olhClientId) {
    // if the user logs in to a different RP, then we won't show them the account kept notificaton
    // when they log in to Home
    items.push({
      Delete: {
        TableName: userNotificationsTableName,
        Key: { internalCommonSubjectId: userId },
      },
    });
  }

  return items;
};

const getNewItemDetails = (
  txmaEvent: TxmaEvent,
  currentTrackerRecord: InactiveAccountTrackerRecord | null,
  eventDate: Date,
  eventDateTime: string
) => {
  const isNewLatestDate = eventDate > (currentTrackerRecord ? new Date(currentTrackerRecord.userLastActive) : new Date(0));
  
  const recordedEmailLastUpdatedDate = currentTrackerRecord?.emailAddressLastUpdated 
    ? new Date(currentTrackerRecord.emailAddressLastUpdated) 
    : new Date(0);
    
  const eventHasNewerEmailLastUpdated = eventDate > recordedEmailLastUpdatedDate;
  
  const newEmailAddress = (() => {
    if (txmaEvent.user?.email && eventHasNewerEmailLastUpdated && txmaEvent.user.email !== currentTrackerRecord?.emailAddress) {
      return txmaEvent.user.email;
    }
  })();

  return {
    emailAddress: newEmailAddress ?? currentTrackerRecord?.emailAddress ?? "",
    emailAddressSource: newEmailAddress ? txmaEvent.event_name : (currentTrackerRecord?.emailAddressSource ?? ""),
    emailAddressSourceId: newEmailAddress ? txmaEvent.event_id : currentTrackerRecord?.emailAddressSourceId,
    emailAddressLastUpdated: newEmailAddress ? eventDateTime : (currentTrackerRecord?.emailAddressLastUpdated ?? ""),
    userLastActiveUpdated: isNewLatestDate ? eventDateTime : (currentTrackerRecord?.userLastActiveUpdated ?? eventDateTime),
    publicSubjectId: txmaEvent.user?.public_subject_id ?? currentTrackerRecord?.publicSubjectId ?? "",
  };
};

const processRecord = async (
  txmaEvent: TxmaEvent,
  tableName: string,
  userNotificationsTableName: string,
  olhClientId: string
): Promise<void> => {
  const userId = txmaEvent.user?.user_id;
  assert(userId !== undefined, "user_id is undefined in the event");

  if (txmaEvent.user?.email === undefined) {
    logger.warn(`AUTH_EVENT_NO_EMAIL for userId ${userId}`);
  }

  const currentTrackerRecord = await getCurrentRecordForUser(userId, tableName);

  if (currentTrackerRecord?.status === 'deleting') {
    logger.warn(`AUTH_EVENT_ON_DELETING_ACCOUNT ${userId}`);
    return;
  }

  const eventDate = getEventDate(txmaEvent);
  const eventDateTime = eventDate.toISOString();

  const latestDate = getLatestDate(eventDate, currentTrackerRecord);
  const properties = getNewItemDetails(txmaEvent, currentTrackerRecord, eventDate, eventDateTime);

  const newItem: InactiveAccountTrackerRecord = {
    commonSubjectId: userId,
    userLastActive: latestDate.toISOString(),
    userLastActiveSource: txmaEvent.event_name,
    ...(txmaEvent.event_id && { userLastActiveSourceId: txmaEvent.event_id }),
    dateForDeletion: getDateForDeletion(latestDate),
    ...properties,
    status: 'pending',
    statusLastUpdated: eventDateTime,
    hasSetupMfa: currentTrackerRecord?.hasSetupMfa ?? false,
  };

  const transactionItems = buildTransactionItems(tableName, userNotificationsTableName, olhClientId, userId, newItem, currentTrackerRecord, txmaEvent);

  try {
    await dynamoDocClient.send(new TransactWriteCommand({ TransactItems: transactionItems }));
  } catch (error) {
    throw new Error(`Failed to update inactive account tracker for user ${userId} ${error}`, {
      cause: error
    });
  }
};

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

    await processRecord(txmaEvent, tableName, userNotificationsTableName, olhClientId);
  }
};
