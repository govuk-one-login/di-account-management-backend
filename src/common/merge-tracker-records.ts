import assert from "node:assert/strict";
import { DynamoDBDocumentClient, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import type { InactiveAccountTrackerRecord } from "./model.js";

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

// A race condition can leave multiple tracker rows for the same user. Combine them into a
// single record, taking each group of fields from whichever duplicate updated it most recently.
// This is the pure computation with no side effects; mergeTrackerRecords persists the result.
export const computeMergedTrackerRecord = (
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

// Collapse a user's duplicate tracker rows into a single record and persist the result.
// Given just a user id, this queries every tracker row for that user, merges them (taking each
// group of fields from whichever duplicate updated it most recently), writes the merged record
// to the surviving row, and deletes the stale duplicate rows — all in one transaction so the
// table is never left with a partial merge. Returns the merged record (or the single existing
// row) so callers can act on the up-to-date data, or null when the user has no tracker rows.
export const mergeTrackerRecords = async (
  userId: string,
  dynamoDocClient: DynamoDBDocumentClient,
  tableName: string
): Promise<InactiveAccountTrackerRecord | null> => {
  const response = await dynamoDocClient.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: "CommonSubjectIdIndex",
      KeyConditionExpression: "commonSubjectId = :id",
      ExpressionAttributeValues: { ":id": userId },
    })
  );

  const records = (response.Items ?? []) as InactiveAccountTrackerRecord[];

  // No rows: nothing to merge or return.
  if (records.length === 0) return null;

  // A single row: it is already the up-to-date record, and no transaction is required.
  if (records.length === 1) return records[0];

  const merged = computeMergedTrackerRecord(records);

  // Delete every stale duplicate row whose dateForDeletion differs from the merged record's.
  // The surviving row (merged.dateForDeletion) is updated in place by the Put, so it must not
  // also be deleted.
  const staleDeletionDates = [
    ...new Set(
      records
        .map((row) => row.dateForDeletion)
        .filter((dateForDeletion) => dateForDeletion !== merged.dateForDeletion)
    ),
  ];

  if (staleDeletionDates.length === 0) {
    // Duplicates that all share the merged dateForDeletion: the Put alone suffices, so no
    // delete/transaction is required.
    return merged;
  }

  const transactItems: ConstructorParameters<typeof TransactWriteCommand>[0]["TransactItems"] = [
    { Put: { TableName: tableName, Item: merged as unknown as Record<string, unknown> } },
    ...staleDeletionDates.map((dateForDeletion) => ({
      Delete: {
        TableName: tableName,
        Key: { dateForDeletion, commonSubjectId: merged.commonSubjectId },
      },
    })),
  ];

  await dynamoDocClient.send(new TransactWriteCommand({ TransactItems: transactItems }));

  return merged;
};
