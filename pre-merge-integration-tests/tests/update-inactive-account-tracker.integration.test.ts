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
  pollForStubOutput,
} from "../aws-helpers.js";

// In demo: OLH_CLIENT_ID="oneLoginHome", GOV_UK_APP_CLIENT_ID="govukApp"
const OLH_CLIENT_ID = "oneLoginHome";
const RP_CLIENT_ID = "someRpClientId";

// A timestamp whose dateForDeletion (timestamp + 5 years) is well outside 30
// days, so no notification is triggered for a first-write scenario.
const PAST_TIMESTAMP_S = 1_000_000_000; // 2001-09-09 — dateForDeletion ~2006

function tomorrowIsoDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

// Returns the expected dateForDeletion ISO string (YYYY-MM-DD) for an event
// sent at `eventTimestampS` unix seconds, which is 5 years later.
function expectedDeletionDate(eventTimestampS: number): string {
  const d = new Date(eventTimestampS * 1000);
  d.setFullYear(d.getFullYear() + 5);
  return d.toISOString().split("T")[0];
}

function trackerCriteria(userId: string) {
  return {
    keyConditionExpression: "commonSubjectId = :id",
    expressionAttributeNames: {} as Record<string, string>,
    expressionAttributeValues: { ":id": userId },
  };
}

function seedTrackerItem(
  userId: string,
  dateForDeletion: string,
  userLastActive: string
) {
  return documentClient.send(
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

      const countResponse1 = await documentClient.send(
        new QueryCommand({
          TableName: TABLES.INACTIVE_ACCOUNT_TRACKER,
          IndexName: "CommonSubjectIdIndex",
          KeyConditionExpression: "commonSubjectId = :id",
          ExpressionAttributeValues: { ":id": userId },
        })
      );
      expect(countResponse1.Items ?? []).toHaveLength(1);

      expect(item.commonSubjectId).toBe(userId);
      expect(item.status).toBe("pending");
      expect(item.userLastActiveSource).toBe(
        "AUTH_TOKEN_SENT_TO_ORCHESTRATION"
      );
      expect(item.dateForDeletion).toBe(expectedDeletionDate(PAST_TIMESTAMP_S));
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

      const countResponse2 = await documentClient.send(
        new QueryCommand({
          TableName: TABLES.INACTIVE_ACCOUNT_TRACKER,
          IndexName: "CommonSubjectIdIndex",
          KeyConditionExpression: "commonSubjectId = :id",
          ExpressionAttributeValues: { ":id": userId },
        })
      );
      expect(countResponse2.Items ?? []).toHaveLength(1);

      expect(item.commonSubjectId).toBe(userId);
      expect(item.status).toBe("pending");
      expect(item.userLastActiveSource).toBe("AUTH_CODE_VERIFIED");
      expect(item.dateForDeletion).toBe(expectedDeletionDate(PAST_TIMESTAMP_S));
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

      const countResponse3 = await documentClient.send(
        new QueryCommand({
          TableName: TABLES.INACTIVE_ACCOUNT_TRACKER,
          IndexName: "CommonSubjectIdIndex",
          KeyConditionExpression: "commonSubjectId = :id",
          ExpressionAttributeValues: { ":id": userId },
        })
      );
      expect(countResponse3.Items ?? []).toHaveLength(1);

      expect(item.commonSubjectId).toBe(userId);
      expect(item.status).toBe("pending");
      expect(item.userLastActiveSource).toBe(
        "AUTH_PASSKEY_VERIFICATION_SUCCESSFUL"
      );
      expect(item.dateForDeletion).toBe(expectedDeletionDate(PAST_TIMESTAMP_S));
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

      const countResponse4 = await documentClient.send(
        new QueryCommand({
          TableName: TABLES.INACTIVE_ACCOUNT_TRACKER,
          IndexName: "CommonSubjectIdIndex",
          KeyConditionExpression: "commonSubjectId = :id",
          ExpressionAttributeValues: { ":id": userId },
        })
      );
      expect(countResponse4.Items ?? []).toHaveLength(1);

      expect(item.commonSubjectId).toBe(userId);
      expect(item.status).toBe("pending");
      expect(item.userLastActiveSource).toBe("STS_REFRESH_TOKEN_ISSUED");
      expect(item.dateForDeletion).toBe(expectedDeletionDate(PAST_TIMESTAMP_S));
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

  it.concurrent(
    "sends HOME_ACCOUNT_TRACKER_ACCOUNT_REACTIVATED audit event and INACTIVE_ACCOUNT_SAVED_RP notification when deletion is within 30 days and client is an RP",
    async () => {
      const userId = generateUserId("iat-reactivation");
      const eventId = generateEventId();
      const testStartEpochS = Math.floor(Date.now() / 1000);

      const existingDate = new Date();
      existingDate.setFullYear(existingDate.getFullYear() - 5);
      const userLastActive = existingDate.toISOString();
      const dateForDeletion = tomorrowIsoDate();

      await seedTrackerItem(userId, dateForDeletion, userLastActive);

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

      const updatedItem = await pollForItem(
        TABLES.INACTIVE_ACCOUNT_TRACKER,
        trackerCriteria(userId),
        {
          indexName: "CommonSubjectIdIndex",
          timeoutSeconds: 30,
          description: `updated tracker record for ${userId}`,
          itemPredicate: (item) => item.dateForDeletion !== dateForDeletion,
        }
      );

      const rpCountResponse = await documentClient.send(
        new QueryCommand({
          TableName: TABLES.INACTIVE_ACCOUNT_TRACKER,
          IndexName: "CommonSubjectIdIndex",
          KeyConditionExpression: "commonSubjectId = :id",
          ExpressionAttributeValues: { ":id": userId },
        })
      );
      expect(rpCountResponse.Items ?? []).toHaveLength(1);

      expect(updatedItem.commonSubjectId).toBe(userId);
      expect(updatedItem.status).toBe("pending");
      expect(updatedItem.userLastActiveSource).toBe("AUTH_CODE_VERIFIED");
      expect(updatedItem.dateForDeletion).toBe(
        expectedDeletionDate(Math.floor(Date.now() / 1000))
      );

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

      await pollForStubOutput(
        testStartEpochS,
        (parsed) =>
          parsed.email_address === `${userId}@example.com` &&
          parsed.template_id === "cb230404-a787-4199-ad4a-7d638838d3e8",
        `RP notification for ${userId}`
      );
    }
  );

  it.concurrent(
    "retains existing userLastActiveSource and dateForDeletion when incoming event is older than existing record",
    async () => {
      const userId = generateUserId("iat-older-event");

      // Seed a record with userLastActive = now
      const recentDate = new Date();
      const userLastActive = recentDate.toISOString();
      const dateForDeletion = new Date();
      dateForDeletion.setFullYear(dateForDeletion.getFullYear() + 5);
      const dateForDeletionStr = dateForDeletion.toISOString().split("T")[0];

      await seedTrackerItem(userId, dateForDeletionStr, userLastActive);

      // Send an event older than the seeded userLastActive
      await sendMessage({
        event_name: "AUTH_TOKEN_SENT_TO_ORCHESTRATION",
        event_id: generateEventId(),
        timestamp: PAST_TIMESTAMP_S,
        client_id: RP_CLIENT_ID,
        user: { user_id: userId, public_subject_id: `pub-${userId}` },
      });

      // Wait for the lambda to have processed the event before asserting
      // nothing was overwritten — same pattern as other negative-assertion tests.
      await new Promise((resolve) => setTimeout(resolve, 15_000)); // NOSONAR

      const response = await documentClient.send(
        new QueryCommand({
          TableName: TABLES.INACTIVE_ACCOUNT_TRACKER,
          IndexName: "CommonSubjectIdIndex",
          KeyConditionExpression: "commonSubjectId = :id",
          ExpressionAttributeValues: { ":id": userId },
        })
      );

      expect(response.Items ?? []).toHaveLength(1);
      const item = (response.Items ?? [])[0];
      expect(item.userLastActiveSource).toBe("AUTH_CODE_VERIFIED"); // seeded value retained
      expect(item.dateForDeletion).toBe(dateForDeletionStr); // not overwritten by older event
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

      const item = await pollForItem(
        TABLES.INACTIVE_ACCOUNT_TRACKER,
        trackerCriteria(userId),
        {
          indexName: "CommonSubjectIdIndex",
          timeoutSeconds: 30,
          description: `tracker record for ${userId}`,
        }
      );

      const noNotifyCountResponse = await documentClient.send(
        new QueryCommand({
          TableName: TABLES.INACTIVE_ACCOUNT_TRACKER,
          IndexName: "CommonSubjectIdIndex",
          KeyConditionExpression: "commonSubjectId = :id",
          ExpressionAttributeValues: { ":id": userId },
        })
      );
      expect(noNotifyCountResponse.Items ?? []).toHaveLength(1);

      expect(item.commonSubjectId).toBe(userId);
      expect(item.status).toBe("pending");
      expect(item.userLastActiveSource).toBe("AUTH_CODE_VERIFIED");
      expect(item.dateForDeletion).toBe(expectedDeletionDate(PAST_TIMESTAMP_S));

      // Wait for async processing to settle then confirm no notification was sent
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
    "sends INACTIVE_ACCOUNT_SAVED_HOME notification when client is OLH and deletion is within 30 days",
    async () => {
      const userId = generateUserId("iat-olh");
      const eventId = generateEventId();
      const testStartEpochS = Math.floor(Date.now() / 1000);

      const existingDate = new Date();
      existingDate.setFullYear(existingDate.getFullYear() - 5);
      const userLastActive = existingDate.toISOString();
      const dateForDeletion = tomorrowIsoDate();

      await seedTrackerItem(userId, dateForDeletion, userLastActive);

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

      const updatedItem = await pollForItem(
        TABLES.INACTIVE_ACCOUNT_TRACKER,
        trackerCriteria(userId),
        {
          indexName: "CommonSubjectIdIndex",
          timeoutSeconds: 30,
          description: `updated tracker record for ${userId}`,
          itemPredicate: (item) => item.dateForDeletion !== dateForDeletion,
        }
      );

      const olhCountResponse = await documentClient.send(
        new QueryCommand({
          TableName: TABLES.INACTIVE_ACCOUNT_TRACKER,
          IndexName: "CommonSubjectIdIndex",
          KeyConditionExpression: "commonSubjectId = :id",
          ExpressionAttributeValues: { ":id": userId },
        })
      );
      expect(olhCountResponse.Items ?? []).toHaveLength(1);

      expect(updatedItem.commonSubjectId).toBe(userId);
      expect(updatedItem.status).toBe("pending");
      expect(updatedItem.userLastActiveSource).toBe("AUTH_CODE_VERIFIED");
      expect(updatedItem.dateForDeletion).toBe(
        expectedDeletionDate(Math.floor(Date.now() / 1000))
      );

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

      await pollForStubOutput(
        testStartEpochS,
        (parsed) =>
          parsed.email_address === `${userId}@example.com` &&
          parsed.template_id === "bbde3b58-62ea-4ccd-8a41-ebd421745af8",
        `OLH notification for ${userId}`
      );
    }
  );

  it.concurrent(
    "sends INACTIVE_ACCOUNT_SAVED_APP notification when client is govukApp (STS_REFRESH_TOKEN_ISSUED with no client_id) and deletion is within 30 days",
    async () => {
      const userId = generateUserId("iat-app");
      const eventId = generateEventId();
      const testStartEpochS = Math.floor(Date.now() / 1000);

      const existingDate = new Date();
      existingDate.setFullYear(existingDate.getFullYear() - 5);
      const userLastActive = existingDate.toISOString();
      const dateForDeletion = tomorrowIsoDate();

      await seedTrackerItem(userId, dateForDeletion, userLastActive);

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

      const updatedItem = await pollForItem(
        TABLES.INACTIVE_ACCOUNT_TRACKER,
        trackerCriteria(userId),
        {
          indexName: "CommonSubjectIdIndex",
          timeoutSeconds: 30,
          description: `updated tracker record for ${userId}`,
          itemPredicate: (item) => item.dateForDeletion !== dateForDeletion,
        }
      );

      const appCountResponse = await documentClient.send(
        new QueryCommand({
          TableName: TABLES.INACTIVE_ACCOUNT_TRACKER,
          IndexName: "CommonSubjectIdIndex",
          KeyConditionExpression: "commonSubjectId = :id",
          ExpressionAttributeValues: { ":id": userId },
        })
      );
      expect(appCountResponse.Items ?? []).toHaveLength(1);

      expect(updatedItem.commonSubjectId).toBe(userId);
      expect(updatedItem.status).toBe("pending");
      expect(updatedItem.userLastActiveSource).toBe("STS_REFRESH_TOKEN_ISSUED");
      expect(updatedItem.dateForDeletion).toBe(
        expectedDeletionDate(Math.floor(Date.now() / 1000))
      );

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

      await pollForStubOutput(
        testStartEpochS,
        (parsed) =>
          parsed.email_address === `${userId}@example.com` &&
          parsed.template_id === "7591b854-2c10-4209-97bf-0facbf2c2588",
        `App notification for ${userId}`
      );
    }
  );
});
