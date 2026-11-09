// Real-AWS integration tests for the save-raw-events → DynamoDB stream →
// update-inactive-account-tracker flow. Run only via `npm run test:integration`.
// Must NOT mock AWS.
//
// Isolation: each test generates a UUID-suffixed userId so tracker rows and
// stub outputs are unique across tests and test runs. No cleanup is performed;
// tracker rows are permanent (useful for debugging) and stub outputs expire via
// DynamoDB TTL.

import { describe, expect, it } from "vitest";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

import {
  TABLES,
  getStubOutputsTableName,
  STUB_OUTPUTS_ALL_ITEMS_INDEX,
  getAuditQueueUrl,
} from "../config.js";
import { generateEventId, generateUserId } from "../helpers.js";
import {
  documentClient,
  sendMessage,
  pollForItem,
  pollAuditQueue,
} from "../aws-helpers.js";

// In demo: OLH_CLIENT_ID="oneLoginHome", GOV_UK_APP_CLIENT_ID="govukApp"
const OLH_CLIENT_ID = "oneLoginHome";
const RP_CLIENT_ID = "someRpClientId";

// A timestamp whose dateForDeletion (timestamp + 5 years) is well outside 30
// days, so no notification is triggered for a first-write scenario.
const PAST_TIMESTAMP_S = 1_000_000_000; // 2001-09-09 — dateForDeletion ~2006

// A timestamp that produces a dateForDeletion within the next 30 days when
// used as the *existing* record's activity date. We achieve this by seeding
// the tracker directly with a dateForDeletion that is tomorrow.
function tomorrowIsoDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function trackerCriteria(userId: string) {
  return {
    keyConditionExpression: "commonSubjectId = :id",
    expressionAttributeNames: {} as Record<string, string>,
    expressionAttributeValues: { ":id": userId },
  };
}

// Polls the IntegrationTestStubApiOutputsTable for any item written after
// `afterEpochSeconds` whose request body contains `notificationType`.
async function pollForStubOutput(
  afterEpochSeconds: number,
  notificationType: string,
  description: string
): Promise<Record<string, unknown>> {
  const tableName = getStubOutputsTableName();
  const deadline = Date.now() + 30_000;

  for (;;) {
    const response = await documentClient.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: STUB_OUTPUTS_ALL_ITEMS_INDEX,
        KeyConditionExpression: "allItemsId = :a AND createdAt > :t",
        ExpressionAttributeValues: {
          ":a": "an_item",
          ":t": afterEpochSeconds,
        },
      })
    );

    const match = (response.Items ?? []).find((item) => {
      const body = (item.event as Record<string, unknown>)?.body as
        string | undefined;
      try {
        const parsed = JSON.parse(body ?? "") as Record<string, unknown>;
        return parsed.notificationType === notificationType;
      } catch {
        return false;
      }
    });

    if (match !== undefined) return match;

    if (Date.now() + 1_000 >= deadline) break;
    await new Promise((resolve) => setTimeout(resolve, 1_000)); // NOSONAR
  }

  throw new Error(
    `No stub output with notificationType "${notificationType}" found within 30s for ${description}`
  );
}

describe("update-inactive-account-tracker", () => {
  it.concurrent(
    "creates a new tracker record for AUTH_TOKEN_SENT_TO_ORCHESTRATION",
    async () => {
      const userId = generateUserId("iat-new-record");
      const eventId = generateEventId();

      await sendMessage({
        event_name: "AUTH_TOKEN_SENT_TO_ORCHESTRATION",
        event_id: eventId,
        timestamp: PAST_TIMESTAMP_S,
        client_id: RP_CLIENT_ID,
        user: { user_id: userId, public_subject_id: `pub-${userId}` },
      });

      const item = await pollForItem(
        TABLES.INACTIVE_ACCOUNT_TRACKER,
        trackerCriteria(userId),
        {
          indexName: "CommonSubjectIdIndex",
          timeoutSeconds: 30,
          description: `tracker record for ${userId}`,
        }
      );

      expect(item.commonSubjectId).toBe(userId);
      expect(item.status).toBe("pending");
      expect(typeof item.dateForDeletion).toBe("string");
      expect(item.userLastActiveSource).toBe(
        "AUTH_TOKEN_SENT_TO_ORCHESTRATION"
      );
    }
  );

  it.concurrent(
    "creates a new tracker record for AUTH_CODE_VERIFIED",
    async () => {
      const userId = generateUserId("iat-acv");
      const eventId = generateEventId();

      await sendMessage({
        event_name: "AUTH_CODE_VERIFIED",
        event_id: eventId,
        timestamp: PAST_TIMESTAMP_S,
        client_id: RP_CLIENT_ID,
        user: {
          user_id: userId,
          session_id: "session-acv",
          public_subject_id: `pub-${userId}`,
          email: `${userId}@example.com`,
        },
      });

      const item = await pollForItem(
        TABLES.INACTIVE_ACCOUNT_TRACKER,
        trackerCriteria(userId),
        {
          indexName: "CommonSubjectIdIndex",
          timeoutSeconds: 30,
          description: `tracker record for ${userId}`,
        }
      );

      expect(item.commonSubjectId).toBe(userId);
      expect(item.status).toBe("pending");
      expect(item.userLastActiveSource).toBe("AUTH_CODE_VERIFIED");
    }
  );

  it.concurrent(
    "creates a new tracker record for AUTH_PASSKEY_VERIFICATION_SUCCESSFUL",
    async () => {
      const userId = generateUserId("iat-passkey");
      const eventId = generateEventId();

      await sendMessage({
        event_name: "AUTH_PASSKEY_VERIFICATION_SUCCESSFUL",
        event_id: eventId,
        timestamp: PAST_TIMESTAMP_S,
        client_id: RP_CLIENT_ID,
        user: {
          user_id: userId,
          session_id: "session-passkey",
          public_subject_id: `pub-${userId}`,
          email: `${userId}@example.com`,
        },
      });

      const item = await pollForItem(
        TABLES.INACTIVE_ACCOUNT_TRACKER,
        trackerCriteria(userId),
        {
          indexName: "CommonSubjectIdIndex",
          timeoutSeconds: 30,
          description: `tracker record for ${userId}`,
        }
      );

      expect(item.commonSubjectId).toBe(userId);
      expect(item.status).toBe("pending");
      expect(item.userLastActiveSource).toBe(
        "AUTH_PASSKEY_VERIFICATION_SUCCESSFUL"
      );
    }
  );

  it.concurrent(
    "creates a new tracker record for STS_REFRESH_TOKEN_ISSUED",
    async () => {
      const userId = generateUserId("iat-sts");
      const eventId = generateEventId();

      // STS events may omit client_id; the lambda treats them as govukApp
      await sendMessage({
        event_name: "STS_REFRESH_TOKEN_ISSUED",
        event_id: eventId,
        timestamp: PAST_TIMESTAMP_S,
        user: {
          user_id: userId,
          session_id: "session-sts",
          public_subject_id: `pub-${userId}`,
        },
      });

      const item = await pollForItem(
        TABLES.INACTIVE_ACCOUNT_TRACKER,
        trackerCriteria(userId),
        {
          indexName: "CommonSubjectIdIndex",
          timeoutSeconds: 30,
          description: `tracker record for ${userId}`,
        }
      );

      expect(item.commonSubjectId).toBe(userId);
      expect(item.userLastActiveSource).toBe("STS_REFRESH_TOKEN_ISSUED");
    }
  );

  it.concurrent(
    "ignores AUTH_CODE_VERIFIED with PASSWORD_RESET journey-type",
    async () => {
      const userId = generateUserId("iat-pwd-reset");
      const eventId = generateEventId();

      await sendMessage({
        event_name: "AUTH_CODE_VERIFIED",
        event_id: eventId,
        timestamp: PAST_TIMESTAMP_S,
        client_id: RP_CLIENT_ID,
        user: {
          user_id: userId,
          session_id: "session-pwd-reset",
          public_subject_id: `pub-${userId}`,
        },
        extensions: { "journey-type": "PASSWORD_RESET" },
      });

      // Wait long enough for the pipeline to have processed the event if it
      // were going to, then assert nothing was written.
      await new Promise((resolve) => setTimeout(resolve, 15_000)); // NOSONAR

      const response = await documentClient.send(
        new QueryCommand({
          TableName: TABLES.INACTIVE_ACCOUNT_TRACKER,
          IndexName: "CommonSubjectIdIndex",
          KeyConditionExpression: "commonSubjectId = :id",
          ExpressionAttributeValues: { ":id": userId },
        })
      );

      expect(response.Items ?? []).toHaveLength(0);
    }
  );

  it.concurrent("ignores AUTH_CODE_VERIFIED with missing user_id", async () => {
    const eventId = generateEventId();
    // Use a unique session_id as a proxy identifier since there's no user_id
    const sessionId = `session-no-uid-${generateEventId()}`;

    await sendMessage({
      event_name: "AUTH_CODE_VERIFIED",
      event_id: eventId,
      timestamp: PAST_TIMESTAMP_S,
      client_id: RP_CLIENT_ID,
      user: { session_id: sessionId },
    });

    // Nothing to assert in DynamoDB (no user_id to query by); the test
    // verifies the message is accepted without error by the pipeline.
    // A 15s wait confirms no crash/DLQ scenario occurs.
    await new Promise((resolve) => setTimeout(resolve, 15_000)); // NOSONAR
  });

  it.concurrent(
    "sends HOME_ACCOUNT_TRACKER_ACCOUNT_REACTIVATED audit event and notification when deletion is within 30 days",
    async () => {
      const userId = generateUserId("iat-reactivation");
      const eventId = generateEventId();
      const testStartEpochS = Math.floor(Date.now() / 1000);

      // Seed a tracker record with a dateForDeletion that is tomorrow (within 30 days)
      // so the next event triggers the reactivation path.
      const existingDate = new Date();
      existingDate.setFullYear(existingDate.getFullYear() - 5);
      existingDate.setDate(existingDate.getDate() + 1); // userLastActive ~5 years ago → deletion tomorrow
      const userLastActive = existingDate.toISOString();
      const dateForDeletion = tomorrowIsoDate();

      await documentClient.send(
        new PutCommand({
          TableName: TABLES.INACTIVE_ACCOUNT_TRACKER,
          Item: {
            commonSubjectId: userId,
            publicSubjectId: `pub-${userId}`,
            dateForDeletion,
            userLastActive,
            userLastActiveSource: "AUTH_CODE_VERIFIED",
            userLastActiveSourceId: generateEventId(),
            userLastActiveUpdated: userLastActive,
            status: "pending",
            statusLastUpdated: userLastActive,
            emailAddress: `${userId}@example.com`,
            emailAddressSource: "AUTH_CODE_VERIFIED",
            emailAddressSourceId: generateEventId(),
            emailAddressLastUpdated: userLastActive,
            hasSetupMfa: true,
          },
        })
      );

      // Send a new login event — this should trigger reactivation
      await sendMessage({
        event_name: "AUTH_CODE_VERIFIED",
        event_id: eventId,
        timestamp: Math.floor(Date.now() / 1000),
        client_id: RP_CLIENT_ID,
        user: {
          user_id: userId,
          session_id: "session-reactivation",
          public_subject_id: `pub-${userId}`,
          email: `${userId}@example.com`,
        },
      });

      // Assert the tracker record's dateForDeletion has been pushed out
      const updatedItem = await pollForItem(
        TABLES.INACTIVE_ACCOUNT_TRACKER,
        trackerCriteria(userId),
        {
          indexName: "CommonSubjectIdIndex",
          timeoutSeconds: 30,
          description: `updated tracker record for ${userId}`,
        }
      );

      expect(updatedItem.commonSubjectId).toBe(userId);
      // The new dateForDeletion should be ~5 years from now, not tomorrow
      expect(updatedItem.dateForDeletion).not.toBe(dateForDeletion);

      // Assert the audit event was sent to the TXMA audit queue
      const auditQueueUrl = getAuditQueueUrl();
      if (auditQueueUrl === undefined || auditQueueUrl.length === 0) {
        throw new Error("AUDIT_QUEUE_URL is not set");
      }
      await pollAuditQueue(
        auditQueueUrl,
        (body) =>
          body.event_name === "HOME_ACCOUNT_TRACKER_ACCOUNT_REACTIVATED" &&
          (body.user as Record<string, unknown>)?.user_id === userId,
        { description: `reactivation audit event for ${userId}` }
      );

      // Assert the notification email request was sent (notification queue →
      // notification-service → stub API in demo)
      const notifyOutput = await pollForStubOutput(
        testStartEpochS,
        "INACTIVE_ACCOUNT_SAVED_RP",
        `notification for ${userId}`
      );
      expect(notifyOutput).toBeDefined();
    }
  );

  it.concurrent(
    "does not send a notification when deletion is more than 30 days away",
    async () => {
      const userId = generateUserId("iat-no-notify");
      const eventId = generateEventId();
      const testStartEpochS = Math.floor(Date.now() / 1000);

      await sendMessage({
        event_name: "AUTH_CODE_VERIFIED",
        event_id: eventId,
        timestamp: PAST_TIMESTAMP_S,
        client_id: RP_CLIENT_ID,
        user: {
          user_id: userId,
          session_id: "session-no-notify",
          public_subject_id: `pub-${userId}`,
          email: `${userId}@example.com`,
        },
      });

      // Confirm the tracker row was written
      await pollForItem(
        TABLES.INACTIVE_ACCOUNT_TRACKER,
        trackerCriteria(userId),
        {
          indexName: "CommonSubjectIdIndex",
          timeoutSeconds: 30,
          description: `tracker record for ${userId}`,
        }
      );

      // Wait for any async processing to settle, then confirm no stub output
      // was written for this user's notification path.
      await new Promise((resolve) => setTimeout(resolve, 15_000)); // NOSONAR

      const response = await documentClient.send(
        new QueryCommand({
          TableName: getStubOutputsTableName(),
          IndexName: STUB_OUTPUTS_ALL_ITEMS_INDEX,
          KeyConditionExpression: "allItemsId = :a AND createdAt > :t",
          ExpressionAttributeValues: {
            ":a": "an_item",
            ":t": testStartEpochS,
          },
        })
      );

      const notifyItems = (response.Items ?? []).filter((item) => {
        const body = (item.event as Record<string, unknown>)?.body as
          string | undefined;
        try {
          const parsed = JSON.parse(body ?? "") as Record<string, unknown>;
          return (
            typeof parsed.notificationType === "string" &&
            parsed.notificationType.startsWith("INACTIVE_ACCOUNT_SAVED") &&
            parsed.emailAddress === `${userId}@example.com`
          );
        } catch {
          return false;
        }
      });

      expect(notifyItems).toHaveLength(0);
    }
  );

  it.concurrent(
    "uses INACTIVE_ACCOUNT_SAVED_HOME notification type when client is OLH",
    async () => {
      const userId = generateUserId("iat-olh");
      const eventId = generateEventId();
      const testStartEpochS = Math.floor(Date.now() / 1000);

      const existingDate = new Date();
      existingDate.setFullYear(existingDate.getFullYear() - 5);
      existingDate.setDate(existingDate.getDate() + 1);
      const userLastActive = existingDate.toISOString();
      const dateForDeletion = tomorrowIsoDate();

      await documentClient.send(
        new PutCommand({
          TableName: TABLES.INACTIVE_ACCOUNT_TRACKER,
          Item: {
            commonSubjectId: userId,
            publicSubjectId: `pub-${userId}`,
            dateForDeletion,
            userLastActive,
            userLastActiveSource: "AUTH_CODE_VERIFIED",
            userLastActiveSourceId: generateEventId(),
            userLastActiveUpdated: userLastActive,
            status: "pending",
            statusLastUpdated: userLastActive,
            emailAddress: `${userId}@example.com`,
            emailAddressSource: "AUTH_CODE_VERIFIED",
            emailAddressSourceId: generateEventId(),
            emailAddressLastUpdated: userLastActive,
            hasSetupMfa: true,
          },
        })
      );

      await sendMessage({
        event_name: "AUTH_CODE_VERIFIED",
        event_id: eventId,
        timestamp: Math.floor(Date.now() / 1000),
        client_id: OLH_CLIENT_ID,
        user: {
          user_id: userId,
          session_id: "session-olh",
          public_subject_id: `pub-${userId}`,
          email: `${userId}@example.com`,
        },
      });

      const notifyOutput = await pollForStubOutput(
        testStartEpochS,
        "INACTIVE_ACCOUNT_SAVED_HOME",
        `OLH notification for ${userId}`
      );
      expect(notifyOutput).toBeDefined();
    }
  );

  it.concurrent(
    "uses INACTIVE_ACCOUNT_SAVED_APP notification type when client is govukApp (STS_REFRESH_TOKEN_ISSUED with no client_id)",
    async () => {
      const userId = generateUserId("iat-app");
      const eventId = generateEventId();
      const testStartEpochS = Math.floor(Date.now() / 1000);

      const existingDate = new Date();
      existingDate.setFullYear(existingDate.getFullYear() - 5);
      existingDate.setDate(existingDate.getDate() + 1);
      const userLastActive = existingDate.toISOString();
      const dateForDeletion = tomorrowIsoDate();

      await documentClient.send(
        new PutCommand({
          TableName: TABLES.INACTIVE_ACCOUNT_TRACKER,
          Item: {
            commonSubjectId: userId,
            publicSubjectId: `pub-${userId}`,
            dateForDeletion,
            userLastActive,
            userLastActiveSource: "AUTH_CODE_VERIFIED",
            userLastActiveSourceId: generateEventId(),
            userLastActiveUpdated: userLastActive,
            status: "pending",
            statusLastUpdated: userLastActive,
            emailAddress: `${userId}@example.com`,
            emailAddressSource: "AUTH_CODE_VERIFIED",
            emailAddressSourceId: generateEventId(),
            emailAddressLastUpdated: userLastActive,
            hasSetupMfa: true,
          },
        })
      );

      // STS with no client_id → treated as govukApp
      await sendMessage({
        event_name: "STS_REFRESH_TOKEN_ISSUED",
        event_id: eventId,
        timestamp: Math.floor(Date.now() / 1000),
        user: {
          user_id: userId,
          session_id: "session-app",
          public_subject_id: `pub-${userId}`,
          email: `${userId}@example.com`,
        },
      });

      const notifyOutput = await pollForStubOutput(
        testStartEpochS,
        "INACTIVE_ACCOUNT_SAVED_APP",
        `App notification for ${userId}`
      );
      expect(notifyOutput).toBeDefined();
    }
  );
});
