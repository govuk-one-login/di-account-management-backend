// Real-AWS integration test verifies
// that the four IAD audit events sent via SQS → SaveRawEvents → DynamoDB Stream
// → UpdateInactiveAccountTracker produce a single correct record in
// inactive_account_tracker_store, trigger the correct Notify email, and emit
// the correct TxMA audit events. Must NOT mock AWS.

import { afterEach, describe, expect, it } from "vitest";
import { PutCommand } from "@aws-sdk/lib-dynamodb";

import {
  TABLES,
  INACTIVE_ACCOUNT_TRACKER_INDEX,
  getTxmaQueueUrl,
  getNotificationQueueUrl,
  MissingConfigError,
} from "../config.js";
import { generateUserId, generateEventId } from "../helpers.js";
import {
  documentClient,
  sendMessage,
  pollForExactlyOneItem,
  pollForSqsMessage,
  deleteItem,
  type MatchCriteria,
} from "../aws-helpers.js";

// A fixed base timestamp (seconds) for the first event. Each subsequent event
// gets +1s so the last event deterministically wins userLastActiveSource.
// The tracker sets dateForDeletion to 5 years from the highest timestamp, so
// EXPECTED_DATE_FOR_DELETION is derived from the last event's timestamp.
const BASE_EVENT_TIMESTAMP_S = 1788220800; // 2026-09-01T00:00:00.000Z — after all known backfill thresholds (latest: 2026-08-25)
// The four IAD audit events that flow through SaveRawEvents into the tracker.
const IAD_EVENT_NAMES = [
  "AUTH_AUTH_CODE_ISSUED",
  "AUTH_IPV_AUTHORISATION_REQUESTED",
  "AUTH_IPV_SUCCESSFUL_IDENTITY_RESPONSE_RECEIVED",
  "AUTH_TOKEN_SENT_TO_ORCHESTRATION",
] as const;
// Last event timestamp = BASE + (IAD_EVENT_NAMES.length - 1) seconds.
const LAST_EVENT_TIMESTAMP_S =
  BASE_EVENT_TIMESTAMP_S + IAD_EVENT_NAMES.length - 1;
// Exact dateForDeletion the tracker will write for the last (highest) timestamp.
const _lastEventDate = new Date(LAST_EVENT_TIMESTAMP_S * 1000);
_lastEventDate.setFullYear(_lastEventDate.getFullYear() + 5);
const EXPECTED_DATE_FOR_DELETION = _lastEventDate.toISOString().split("T")[0];

const SESSION_ID = "iad-tracker-integration-session";
const CLIENT_ID = "vehicleOperatorLicense";
const PUBLIC_SUBJECT_ID = "iad-test-public-subject-id";

// Derives a unique email from the userId so the notification queue predicate
// cannot match a message produced by a different test run.
function emailForUser(userId: string): string {
  return `${userId}@example.gov.uk`;
}

// "7 day warning" state and ensures the tracker's 30-day notification window
// is triggered when the events arrive.
function sevenDayWarningDeletionDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 5);
  return d.toISOString().split("T")[0];
}

function trackerCriteria(userId: string): MatchCriteria {
  return {
    keyConditionExpression: "commonSubjectId = :id",
    expressionAttributeValues: { ":id": userId },
  };
}

describe("iad-tracker", () => {
  let userId: string | undefined;
  let seedDeletionDate: string | undefined;

  afterEach(async () => {
    if (userId !== undefined && seedDeletionDate !== undefined) {
      try {
        await deleteItem(TABLES.INACTIVE_ACCOUNT_TRACKER, {
          commonSubjectId: userId,
          dateForDeletion: seedDeletionDate,
        });
      } catch {
        // Cleanup failures must not fail the test.
      }
    }

    // Clean up the updated record written by the tracker (dateForDeletion
    // changes from the seed value to EXPECTED_DATE_FOR_DELETION).
    if (userId !== undefined) {
      try {
        await deleteItem(TABLES.INACTIVE_ACCOUNT_TRACKER, {
          commonSubjectId: userId,
          dateForDeletion: EXPECTED_DATE_FOR_DELETION,
        });
      } catch {
        // Cleanup failures must not fail the test.
      }
    }

    userId = undefined;
    seedDeletionDate = undefined;
  });

  it.concurrent(
    "processes four IAD events and produces a single pending record with a ~5-year dateForDeletion, sends the correct Notify email, and emits the correct TxMA audit events",
    async () => {
      const txmaQueueUrl = getTxmaQueueUrl();
      const notificationQueueUrl = getNotificationQueueUrl();

      if (
        txmaQueueUrl === undefined ||
        txmaQueueUrl.length === 0 ||
        notificationQueueUrl === undefined ||
        notificationQueueUrl.length === 0
      ) {
        throw new MissingConfigError(
          "TXMA_SQS_QUEUE_URL and NOTIFICATION_SQS_QUEUE_URL are required for this test"
        );
      }

      const localUserId = generateUserId("iad-tracker");
      userId = localUserId;
      seedDeletionDate = sevenDayWarningDeletionDate();

      const email = emailForUser(localUserId);

      // Seed a record in the 7-day warning state so the tracker's 30-day
      // notification window fires when the events arrive.
      try {
        await documentClient.send(
          new PutCommand({
            TableName: TABLES.INACTIVE_ACCOUNT_TRACKER,
            Item: {
              commonSubjectId: localUserId,
              dateForDeletion: seedDeletionDate,
              status: "7DayWarningSent",
              statusLastUpdated: new Date().toISOString(),
              userLastActive: new Date(
                (BASE_EVENT_TIMESTAMP_S - 1) * 1000
              ).toISOString(),
              userLastActiveSource: "AUTH_AUTH_CODE_ISSUED",
              userLastActiveUpdated: new Date().toISOString(),
              emailAddress: email,
              emailAddressSource: "AUTH_AUTH_CODE_ISSUED",
              emailAddressLastUpdated: new Date().toISOString(),
              publicSubjectId: PUBLIC_SUBJECT_ID,
              hasSetupMfa: true,
            },
          })
        );
      } catch (error) {
        throw new Error(
          `Failed to seed IAD tracker record for user "${localUserId}". Cause: ${String(error)}`,
          { cause: error }
        );
      }

      // Send all four IAD events with incrementing timestamps so the last
      // event deterministically wins userLastActiveSource. Capture the last
      // event_id so we can poll until the record reflects it, proving all
      // four events have been fully processed.
      let lastEventId = "";
      for (const [i, eventName] of IAD_EVENT_NAMES.entries()) {
        const eventId = generateEventId();
        if (i === IAD_EVENT_NAMES.length - 1) lastEventId = eventId;
        const timestampS = BASE_EVENT_TIMESTAMP_S + i;
        await sendMessage({
          event_name: eventName,
          event_id: eventId,
          timestamp: timestampS,
          event_timestamp_ms: timestampS * 1000,
          client_id: CLIENT_ID,
          user: {
            user_id: localUserId,
            session_id: SESSION_ID,
            email,
            public_subject_id: PUBLIC_SUBJECT_ID,
          },
        });
      }

      // Assert: exactly one record exists and it reflects the last event,
      // proving all four events have been processed and merged.
      const item = await pollForExactlyOneItem(
        TABLES.INACTIVE_ACCOUNT_TRACKER,
        trackerCriteria(localUserId),
        {
          indexName: INACTIVE_ACCOUNT_TRACKER_INDEX,
          timeoutSeconds: 60,
          description: `IAD tracker record for user ${localUserId} with lastEventId ${lastEventId}`,
          matchItem: (candidate) =>
            candidate.userLastActiveSourceId === lastEventId,
        }
      );

      expect(item.commonSubjectId).toBe(localUserId);
      expect(item.status).toBe("pending");

      // dateForDeletion must be exactly 5 years from the fixed event timestamp.
      expect(item.dateForDeletion).toBe(EXPECTED_DATE_FOR_DELETION);

      // Assert: the correct email notification was sent to the Notify queue.
      await pollForSqsMessage(
        notificationQueueUrl,
        (body) =>
          body.emailAddress === email &&
          typeof body.notificationType === "string" &&
          body.notificationType.startsWith("INACTIVE_ACCOUNT_SAVED"),
        {
          timeoutSeconds: 60,
          description: `INACTIVE_ACCOUNT_SAVED notification for ${email}`,
        }
      );

      // Assert: the HOME_ACCOUNT_TRACKER_ACCOUNT_REACTIVATED audit event was
      // sent to the TxMA queue.
      await pollForSqsMessage(
        txmaQueueUrl,
        (body) =>
          body.event_name === "HOME_ACCOUNT_TRACKER_ACCOUNT_REACTIVATED" &&
          typeof body.user === "object" &&
          body.user !== null &&
          (body.user as Record<string, unknown>).user_id === localUserId,
        {
          timeoutSeconds: 60,
          description: `HOME_ACCOUNT_TRACKER_ACCOUNT_REACTIVATED for user ${localUserId}`,
        }
      );

      // Assert: the HOME_ACCOUNT_TRACKER_NOTIFICATION_REQUESTED audit event
      // was sent to the TxMA queue.
      await pollForSqsMessage(
        txmaQueueUrl,
        (body) =>
          body.event_name === "HOME_ACCOUNT_TRACKER_NOTIFICATION_REQUESTED" &&
          typeof body.user === "object" &&
          body.user !== null &&
          (body.user as Record<string, unknown>).user_id === localUserId,
        {
          timeoutSeconds: 60,
          description: `HOME_ACCOUNT_TRACKER_NOTIFICATION_REQUESTED for user ${localUserId}`,
        }
      );
    }
  );
});
