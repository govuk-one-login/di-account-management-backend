import assert from "node:assert/strict";
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
