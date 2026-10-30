// Real-AWS integration test (run only via `npm run test:integration`): verifies
// AUTH_AUTH_CODE_ISSUED produces an activity_log item. Must NOT mock AWS.

import { afterEach, describe, expect, it } from "vitest";
import { PutCommand } from "@aws-sdk/lib-dynamodb";

import { TABLES } from "../config.js";
import { generateEventId, generateUserId } from "../helpers.js";
import {
  documentClient,
  sendMessage,
  pollForItem,
  deleteItem,
  type MatchCriteria,
} from "../aws-helpers.js";

const CLIENT_ID = "vehicleOperatorLicense";
const TIMESTAMP = 1730800548523;
const SESSION_ID = "7340477f-74da-46d4-9400-d22ae518da3a";

interface UserServicesItem {
  user_id: string;
  services: {
    client_id: string;
    count_successful_logins: number;
    last_accessed: number;
    last_accessed_pretty: string;
  }[];
}

function activityLogCriteria(userId: string, eventId: string): MatchCriteria {
  return {
    keyConditionExpression: "#uid = :uid AND #eid = :eid",
    expressionAttributeNames: {
      "#uid": "user_id",
      "#eid": "event_id",
    },
    expressionAttributeValues: {
      ":uid": userId,
      ":eid": eventId,
    },
  };
}

describe("auth-code-issued", () => {
  // Generated per-case for isolation; cleanup reads them from this shared handle.
  let userId: string | undefined;
  let eventId: string | undefined;

  afterEach(async () => {
    if (eventId !== undefined && userId !== undefined) {
      try {
        await deleteItem(TABLES.ACTIVITY_LOG, {
          event_id: eventId,
          user_id: userId,
        });
      } catch {
        // Cleanup failures must not fail the test.
      }
    }

    if (userId !== undefined) {
      try {
        await deleteItem(TABLES.USER_SERVICES, { user_id: userId });
      } catch {
        // Cleanup failures must not fail the test.
      }
    }

    userId = undefined;
    eventId = undefined;
  });

  it.concurrent(
    "creates an activity_log item for AUTH_AUTH_CODE_ISSUED",
    async () => {
      const localUserId = generateUserId("auth-code-issued");
      const localEventId = generateEventId();
      userId = localUserId;
      eventId = localEventId;

      const seedItem: UserServicesItem = {
        user_id: localUserId,
        services: [
          {
            client_id: CLIENT_ID,
            count_successful_logins: 1,
            last_accessed: TIMESTAMP,
            last_accessed_pretty: "5 November 2024",
          },
        ],
      };

      try {
        await documentClient.send(
          new PutCommand({
            TableName: TABLES.USER_SERVICES,
            Item: seedItem,
          })
        );
      } catch (error) {
        throw new Error(
          `Failed to seed user_services item for user "${localUserId}"; ` +
            `no message was sent. Cause: ${String(error)}`,
          { cause: error }
        );
      }

      await sendMessage({
        event_name: "AUTH_AUTH_CODE_ISSUED",
        event_id: localEventId,
        user: {
          user_id: localUserId,
          session_id: SESSION_ID,
        },
        client_id: CLIENT_ID,
        timestamp: TIMESTAMP,
      });

      const item = await pollForItem(
        TABLES.ACTIVITY_LOG,
        activityLogCriteria(localUserId, localEventId),
        {
          timeoutSeconds: 30,
          description: `activity log for user ${localUserId}`,
        }
      );

      expect(item.user_id).toBe(localUserId);
      expect(item.event_id).toBe(localEventId);
    }
  );
});
