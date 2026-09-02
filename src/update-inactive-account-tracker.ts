import { Context, DynamoDBStreamEvent, DynamoDBBatchResponse } from "aws-lambda";
import { AttributeValue, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { TxmaEvent } from "./common/model.js";
import { getEnvironmentVariable } from "./common/utils.js";
import { Logger } from "@aws-lambda-powertools/logger";
import type { InactiveAccountTrackerRecord } from "./common/model.ts";
import assert from 'node:assert/strict';
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { NotificationType } from "./notification-service-utils.js"

const logger = new Logger();
const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(dynamoClient);
const sqsClient = new SQSClient();

type TransactionItems = ConstructorParameters<typeof TransactWriteCommand>[0]['TransactItems']

const toTime = (value: string | undefined): number => {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

// Picks the record whose timestamp field is the most recent. Ties keep the first record.
const latestBy = (
  records: InactiveAccountTrackerRecord[],
  timestampField: keyof InactiveAccountTrackerRecord
): InactiveAccountTrackerRecord =>
  records.slice(1).reduce(
    (latest, candidate) =>
      toTime(candidate[timestampField] as string | undefined) > toTime(latest[timestampField] as string | undefined)
        ? candidate
        : latest,
    records[0]
  );

// A race condition can leave multiple tracker rows for the same user. Merge them into a
// single record, taking each group of fields from whichever duplicate updated it most recently.
export const mergeTrackerRecords = (
  records: InactiveAccountTrackerRecord[]
): InactiveAccountTrackerRecord => {
  assert(records.length > 0, "cannot merge an empty set of tracker records");

  const latestActivity = latestBy(records, "userLastActiveUpdated");
  const latestEmail = latestBy(records, "emailAddressLastUpdated");
  const latestStatus = latestBy(records, "statusLastUpdated");

  // The winning userLastActive row also owns dateForDeletion/publicSubjectId, which are
  // derived from the user's most recent activity.
  const merged: InactiveAccountTrackerRecord = {
    commonSubjectId: latestActivity.commonSubjectId,
    publicSubjectId: latestActivity.publicSubjectId,
    dateForDeletion: latestActivity.dateForDeletion,

    userLastActive: latestActivity.userLastActive,
    userLastActiveSource: latestActivity.userLastActiveSource,
    userLastActiveUpdated: latestActivity.userLastActiveUpdated,

    status: latestStatus.status,
    statusLastUpdated: latestStatus.statusLastUpdated,

    // hasSetupMfa/hasUndeliverableEmailAddress have no dedicated timestamp, so treat them
    // as sticky: once any duplicate has flagged them true, keep them true.
    hasSetupMfa: records.some((record) => record.hasSetupMfa),
  };

  const userLastActiveSourceId = latestActivity.userLastActiveSourceId;
  if (userLastActiveSourceId !== undefined) {
    merged.userLastActiveSourceId = userLastActiveSourceId;
  }

  if (latestEmail.emailAddress !== undefined) {
    merged.emailAddress = latestEmail.emailAddress;
    merged.emailAddressLastUpdated = latestEmail.emailAddressLastUpdated;
    merged.emailAddressSource = latestEmail.emailAddressSource;
    merged.emailAddressSourceId = latestEmail.emailAddressSourceId;
  }

  if (records.some((record) => record.hasUndeliverableEmailAddress)) {
    merged.hasUndeliverableEmailAddress = true;
  }

  return merged;
};

const getCurrentRecordForUser = async (
  userId: string,
  tableName: string
): Promise<{ record: InactiveAccountTrackerRecord | null; allRows: InactiveAccountTrackerRecord[] }> => {
  const response = await dynamoDocClient.send(
    new QueryCommand({
      IndexName: "CommonSubjectIdIndex",
      TableName: tableName,
      KeyConditionExpression: "commonSubjectId = :uid",
      ExpressionAttributeValues: { ":uid": userId },
    })
  );

  assert(response.Items !== undefined, "Query response is missing Items");

  const allRows = response.Items as InactiveAccountTrackerRecord[];

  if (allRows.length === 0) {
    return { record: null, allRows };
  }

  if (allRows.length === 1) {
    return { record: allRows[0], allRows };
  }

  // A race condition has produced duplicate rows for this user. Merge them so the
  // caller sees a single, most-up-to-date record; the stale rows are deleted in the
  // write transaction (see buildTransactionItems).
  logger.warn("MERGING_DUPLICATE_INACTIVE_ACCOUNT_TRACKER_RECORDS", {
    userId,
    duplicateCount: allRows.length,
  });

  return { record: mergeTrackerRecords(allRows), allRows };
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

const getNewDateForDeletion = (latestDate: Date): string => {
  const deletionDate = new Date(latestDate);
  deletionDate.setFullYear(deletionDate.getFullYear() + 5);
  return deletionDate.toISOString().split("T")[0];
};

const isCurrentDeletionIn30Days = (deletionDate: string): boolean => {
  const date = new Date(deletionDate);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const thirtyDaysFromToday = new Date(today);
  thirtyDaysFromToday.setDate(today.getDate() + 30);
  
  // Check if deletion dates falls between today and 30 days from now
  return date >= today && date <= thirtyDaysFromToday;
};


const buildTransactionItems = (
  tableName: string,
  userNotificationsTableName: string,
  olhClientId: string,
  userId: string,
  newItem: InactiveAccountTrackerRecord,
  existingRows: InactiveAccountTrackerRecord[],
  txmaEvent: TxmaEvent
): TransactionItems => {
  const items: TransactionItems = [
    { Put: { TableName: tableName, Item: newItem as unknown as Record<string, unknown> } },
  ];

  // Delete every existing row whose dateForDeletion differs from the new item's, keyed on the
  // table's composite primary key (dateForDeletion + commonSubjectId). Rows sharing the new
  // item's dateForDeletion are updated in place by the Put above. When a race condition has
  // produced duplicates this collapses the stale rows so a single merged record remains.
  // De-duplicate the delete keys so a transaction never references the same key twice.
  const staleDeletionDates = [
    ...new Set(
      existingRows
        .map((row) => row.dateForDeletion)
        .filter((dateForDeletion) => dateForDeletion !== newItem.dateForDeletion)
    ),
  ];

  for (const dateForDeletion of staleDeletionDates) {
    items.push({
      Delete: { TableName: tableName, Key: { dateForDeletion, commonSubjectId: userId } },
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

  const emailAddress = newEmailAddress ?? currentTrackerRecord?.emailAddress;

  return {
    ...(emailAddress && { emailAddress }),
    emailAddressSource: newEmailAddress ? txmaEvent.event_name : currentTrackerRecord?.emailAddressSource,
    emailAddressSourceId: newEmailAddress ? txmaEvent.event_id : currentTrackerRecord?.emailAddressSourceId,
    emailAddressLastUpdated: newEmailAddress ? eventDateTime : currentTrackerRecord?.emailAddressLastUpdated,
    userLastActiveUpdated: isNewLatestDate ? eventDateTime : (currentTrackerRecord?.userLastActiveUpdated ?? eventDateTime),
    publicSubjectId: txmaEvent.user?.public_subject_id ?? currentTrackerRecord?.publicSubjectId ?? "",
  };
};

const isBeforeBackfillThreshold = (eventDate: Date, backfillCompleteDatetime: string): boolean => {
  if (!backfillCompleteDatetime) return false;
  return eventDate < new Date(backfillCompleteDatetime);
};

const processRecord = async (
  txmaEvent: TxmaEvent,
  tableName: string,
  userNotificationsTableName: string,
  olhClientId: string,
  backfillCompleteDatetime: string
): Promise<void> => {
  logger.info(`Processing event with ID ${txmaEvent.event_id}`);

  const userId = txmaEvent.user?.user_id;

  if (!userId && txmaEvent.event_name === "AUTH_CODE_VERIFIED") {
    logger.info(`Ignoring AUTH_CODE_VERIFIED event with missing user.user_id`);
    return;
  }

  assert(userId !== undefined, "user_id is undefined in the event");

  // The password reset journey has two CODE_VERIFIED events, the email OTP
  // and sms/app 2FA - confirming the email OTP should not update the tracker
  // as it's not a full login (as neither password nor 2fa have been entered at that point)
  if (
      txmaEvent.event_name === "AUTH_CODE_VERIFIED" &&
      txmaEvent.extensions?.["journey-type"] === "PASSWORD_RESET"
    ) {
    logger.info(`Ignoring AUTH_CODE_VERIFIED event with extensions["journey-type"] of PASSWORD_RESET`);
    return;
  }

  const { record: currentTrackerRecord, allRows: existingRows } = await getCurrentRecordForUser(userId, tableName);

  logger.info(`User has existing tracker record for event_id ${txmaEvent.event_id}: ${Boolean(currentTrackerRecord)}`);

  if (currentTrackerRecord?.status === 'deleting') {
    logger.warn("AUTH_EVENT_ON_DELETING_ACCOUNT");
    return;
  }

  const eventDate = getEventDate(txmaEvent);

  if (isBeforeBackfillThreshold(eventDate, backfillCompleteDatetime) && !currentTrackerRecord) {
    logger.info("BACKFILL_EVENT_SKIPPED_NO_EXISTING_RECORD");
    return;
  }

  const eventDateTime = eventDate.toISOString();

  const latestDate = getLatestDate(eventDate, currentTrackerRecord);
  const properties = getNewItemDetails(txmaEvent, currentTrackerRecord, eventDate, eventDateTime);

  const newItem: InactiveAccountTrackerRecord = {
    commonSubjectId: userId,
    userLastActive: latestDate.toISOString(),
    userLastActiveSource: txmaEvent.event_name,
    ...(txmaEvent.event_id && { userLastActiveSourceId: txmaEvent.event_id }),
    dateForDeletion: getNewDateForDeletion(latestDate),
    ...properties,
    status: 'pending',
    statusLastUpdated: eventDateTime,
    hasSetupMfa: currentTrackerRecord?.hasSetupMfa ?? false,
  };

  logger.info(`Building transaction for update based on event id: ${txmaEvent.event_id}`);

  const transactionItems = buildTransactionItems(tableName, userNotificationsTableName, olhClientId, userId, newItem, existingRows, txmaEvent);
  const notificationQueueUrl = getEnvironmentVariable("NOTIFICATION_QUEUE_URL");
  const govukAppClientId = getEnvironmentVariable("GOV_UK_APP_CLIENT_ID");
  let notificationType;

  switch (txmaEvent.client_id) {
    //  GOVUK App client registry ID
    case govukAppClientId:
      notificationType = NotificationType.INACTIVE_ACCOUNT_SAVED_APP;
      break;
    //  OLH registry ID
    case olhClientId:
      notificationType = NotificationType.INACTIVE_ACCOUNT_SAVED_HOME;
      break;
    default:
      notificationType = NotificationType.INACTIVE_ACCOUNT_SAVED_RP;
  }

  const inactiveAccountEmailFlagEnabled = getEnvironmentVariable("SEND_INACTIVE_ACCOUNT_DELETION_EMAILS") === "1";

  if (!inactiveAccountEmailFlagEnabled) {
    logger.info("SEND_INACTIVE_ACCOUNT_DELETION_EMAILS feature flag is off");
  } else if (currentTrackerRecord?.dateForDeletion && isCurrentDeletionIn30Days(currentTrackerRecord.dateForDeletion)) {
    if (newItem.emailAddress) {
      // if currentTrackerRecord.dateForDeletion is within the next 30 days, send ACCOUNT SAVED email
      const message = {
        notificationType,
        emailAddress: newItem.emailAddress,
      };

      await sqsClient.send(
        new SendMessageCommand({
          QueueUrl: notificationQueueUrl,
          MessageBody: JSON.stringify(message),
        })
      );

      logger.info(`${notificationType} message successfully sent to target queue`);
    } else {
      logger.warn("INACTIVE_ACCOUNT_SAVED_BUT_NO_EMAIL_ADDRESS_TO_NOTIFY");
    }
  }

  try {
    logger.info(`Writing to DynamoDB for event id: ${txmaEvent.event_id}`);
    await dynamoDocClient.send(new TransactWriteCommand({ TransactItems: transactionItems }));
    logger.info(`DynamoDB updated for event id: ${txmaEvent.event_id}`);
  } catch (error) {
    throw new Error(`Failed to update inactive account tracker for event id ${txmaEvent.event_id}: ${error}`, {
      cause: error
    });
  }
};

export const handler = async (
  event: DynamoDBStreamEvent,
  context: Context
): Promise<DynamoDBBatchResponse> => {
  logger.addContext(context);

  const tableName = getEnvironmentVariable("INACTIVE_ACCOUNT_TRACKER_TABLE_NAME");
  const userNotificationsTableName = getEnvironmentVariable("USER_NOTIFICATIONS_TABLE_NAME");
  const olhClientId = getEnvironmentVariable("OLH_CLIENT_ID");
  const backfillCompleteDatetime = process.env["AUTH_BACKFILL_COMPLETE_DATETIME"] ?? "";

  const batchItemFailures: DynamoDBBatchResponse["batchItemFailures"] = [];
  logger.info(`Invoked with ${event.Records.length} to process`);

  for (const record of event.Records) {
    const txmaEvent = unmarshall(
      record.dynamodb?.NewImage?.event.M as Record<string, AttributeValue>
    ) as TxmaEvent;

    try {
      await processRecord(txmaEvent, tableName, userNotificationsTableName, olhClientId, backfillCompleteDatetime);
    } catch (error) {
      logger.error(`Failed to process record ${record.dynamodb?.SequenceNumber}`, { error });
      batchItemFailures.push({ itemIdentifier: record.dynamodb?.SequenceNumber ?? "" });
    }
  }

  return { batchItemFailures };
};
