// Real-AWS integration test (run only via `npm run test:integration`) for the
// account deletion cascade:
//
//   SQS -> SaveRawEvents -> RawEventsStore stream (AUTH_DELETE_ACCOUNT filter)
//   -> PublishAccountDeletion -> SNS UserAccountDeletionTopic
//   -> DeleteUserServices / DeleteActivityLog / DeleteInactiveAccountTracker /
//      DeleteEmailSubscriptions
//
// Must NOT mock AWS. Happy path only: seed a record for one test user in each
// table, send AUTH_DELETE_ACCOUNT, then assert every record is gone and that
// GOV.UK was asked to delete the user's email subscriptions.
//
// In the demo stack DeleteEmailSubscriptions is pointed at the integration test
// stub API (see template.yaml), so the real GOV.UK API is never called and the
// request is observed via the stub outputs table instead.
//
// Isolation: the userId is UUID-suffixed. Seeded rows are removed by the
// deletion flow itself, so no cleanup is needed.

import { describe, expect, it } from "vitest";
import { PutCommand } from "@aws-sdk/lib-dynamodb";

import { TABLES } from "../config.js";
import { generateEventId, generateUserId } from "../helpers.js";
import {
  documentClient,
  sendMessage,
  pollForItem,
  pollForNoItem,
  pollForStubRequest,
  type MatchCriteria,
} from "../aws-helpers.js";

const CLIENT_ID = "someRpClientId";
// The whole cascade has several async hops; allow generous time per assertion.
const CASCADE_TIMEOUT_SECONDS = 90;
const TEST_TIMEOUT_MS = 180_000;

function userServicesCriteria(userId: string): MatchCriteria {
  return {
    keyConditionExpression: "#uid = :uid",
    expressionAttributeNames: { "#uid": "user_id" },
    expressionAttributeValues: { ":uid": userId },
  };
}

function trackerCriteria(userId: string): MatchCriteria {
  return {
    keyConditionExpression: "commonSubjectId = :id",
    expressionAttributeNames: {},
    expressionAttributeValues: { ":id": userId },
  };
}

function seedUserServices(userId: string) {
  return documentClient.send(
    new PutCommand({
      TableName: TABLES.USER_SERVICES,
      Item: {
        user_id: userId,
        services: [
          {
            client_id: CLIENT_ID,
            count_successful_logins: 1,
            last_accessed: Date.now(),
            last_accessed_pretty: "20 November 2026",
          },
        ],
      },
    })
  );
}

function seedActivityLog(userId: string, eventId: string) {
  return documentClient.send(
    new PutCommand({
      TableName: TABLES.ACTIVITY_LOG,
      Item: {
        user_id: userId,
        event_id: eventId,
        event_type: "AUTH_AUTH_CODE_ISSUED",
        session_id: "session-account-deletion",
        timestamp: Date.now(),
        client_id: CLIENT_ID,
        reported_suspicious: false,
      },
    })
  );
}

function seedTrackerItem(userId: string) {
  const now = new Date().toISOString();
  const dateForDeletion = new Date();
  dateForDeletion.setFullYear(dateForDeletion.getFullYear() + 5);

  return documentClient.send(
    new PutCommand({
      TableName: TABLES.INACTIVE_ACCOUNT_TRACKER,
      Item: {
        commonSubjectId: userId,
        publicSubjectId: `pub-${userId}`,
        dateForDeletion: dateForDeletion.toISOString().split("T")[0],
        userLastActive: now,
        userLastActiveSource: "AUTH_CODE_VERIFIED",
        userLastActiveSourceId: generateEventId(),
        userLastActiveUpdated: now,
        status: "pending",
        statusLastUpdated: now,
        emailAddress: `${userId}@example.com`,
        emailAddressSource: "AUTH_CODE_VERIFIED",
        emailAddressSourceId: generateEventId(),
        emailAddressLastUpdated: now,
        hasSetupMfa: true,
      },
    })
  );
}

describe("account-deletion", () => {
  it(
    "deletes the user's data from all tables and requests email subscription deletion on AUTH_DELETE_ACCOUNT",
    async () => {
      const userId = generateUserId("acct-delete");
      const publicSubjectId = `pub-${userId}`;
      const activityEventId = generateEventId();
      const testStartEpochS = Math.floor(Date.now() / 1000);

      await Promise.all([
        seedUserServices(userId),
        seedActivityLog(userId, activityEventId),
        seedTrackerItem(userId),
      ]);

      // Guard against a false pass: confirm the seeded rows are readable before
      // asserting that they disappear.
      await Promise.all([
        pollForItem(TABLES.USER_SERVICES, userServicesCriteria(userId), {
          description: `seeded user_services for ${userId}`,
        }),
        pollForItem(TABLES.ACTIVITY_LOG, userServicesCriteria(userId), {
          description: `seeded activity_log for ${userId}`,
        }),
        pollForItem(TABLES.INACTIVE_ACCOUNT_TRACKER, trackerCriteria(userId), {
          indexName: "CommonSubjectIdIndex",
          description: `seeded tracker record for ${userId}`,
        }),
      ]);

      await sendMessage({
        event_name: "AUTH_DELETE_ACCOUNT",
        event_id: generateEventId(),
        timestamp: Math.floor(Date.now() / 1000),
        user: {
          user_id: userId,
          public_subject_id: publicSubjectId,
        },
      });

      await Promise.all([
        pollForNoItem(TABLES.USER_SERVICES, userServicesCriteria(userId), {
          timeoutSeconds: CASCADE_TIMEOUT_SECONDS,
          description: `user_services for ${userId}`,
        }),
        pollForNoItem(TABLES.ACTIVITY_LOG, userServicesCriteria(userId), {
          timeoutSeconds: CASCADE_TIMEOUT_SECONDS,
          description: `activity_log for ${userId}`,
        }),
        pollForNoItem(
          TABLES.INACTIVE_ACCOUNT_TRACKER,
          trackerCriteria(userId),
          {
            indexName: "CommonSubjectIdIndex",
            timeoutSeconds: CASCADE_TIMEOUT_SECONDS,
            description: `inactive_account_tracker_store for ${userId}`,
          }
        ),
      ]);

      // DeleteEmailSubscriptions calls DELETE {stub}/govuk/api/oidc-users/<sub>.
      const request = await pollForStubRequest(
        testStartEpochS,
        "DELETE",
        `/govuk/api/oidc-users/${publicSubjectId}`,
        `email subscription deletion for ${publicSubjectId}`
      );
      expect(request.allItemsId).toBe("an_item");
    },
    TEST_TIMEOUT_MS
  );
});
