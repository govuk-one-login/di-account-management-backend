import assert from "node:assert/strict";
import { DynamoDBDocumentClient, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
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

// Merge a user's duplicate tracker rows into a single record AND persist the result: the
// merged record is written to the surviving row and every stale duplicate row is deleted, all
// in one transaction so the table is never left with a partial merge. Returns the merged
// record so callers can act on the up-to-date data.
//
// Callers should only invoke this when there is more than one row to merge; a single row (or
// none) needs no transaction. The transaction is skipped defensively in that case anyway.
export const mergeTrackerRecords = async (
  records: InactiveAccountTrackerRecord[],
  dynamoDocClient: DynamoDBDocumentClient,
  tableName: string
): Promise<InactiveAccountTrackerRecord> => {
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
    // Nothing stale to remove (e.g. a single row): no transaction required.
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
