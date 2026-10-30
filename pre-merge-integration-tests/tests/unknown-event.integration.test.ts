// Real-AWS integration test (run only via `npm run test:integration`): verifies
// an unrecognised event_name produces NO activity_log item. Must NOT mock AWS.
// No seeding or cleanup is needed since no item is expected to be created.

import { describe, it } from "vitest";

import { TABLES } from "../config.js";
import { generateEventId, generateUserId } from "../helpers.js";
import {
  sendMessage,
  assertNoItem,
  type MatchCriteria,
} from "../aws-helpers.js";

const CLIENT_ID = "vehicleOperatorLicense";
const TIMESTAMP = 1730800548523;
const SESSION_ID = "7340477f-74da-46d4-9400-d22ae518da3a";
const UNKNOWN_EVENT_NAME = "FABRICATED_EVENT_NAME";
const SEND_TIMEOUT_MS = 10_000;

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

// sendMessage has no internal timeout, so race it against a 10s timer.
async function sendWithin10s(
  payload: Record<string, unknown>
): Promise<string> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(
        new Error(
          "SQS send was not confirmed within 10s; the message could not be " +
            "delivered."
        )
      );
    }, SEND_TIMEOUT_MS);
  });

  try {
    return await Promise.race([sendMessage(payload), timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

describe("unknown-event", () => {
  it.concurrent(
    "creates no activity_log item for an unrecognised event_name",
    async () => {
      const userId = generateUserId("unknown-event");
      const eventId = generateEventId();

      const messageId = await sendWithin10s({
        event_name: UNKNOWN_EVENT_NAME,
        event_id: eventId,
        user: {
          user_id: userId,
          session_id: SESSION_ID,
        },
        client_id: CLIENT_ID,
        timestamp: TIMESTAMP,
      });

      if (typeof messageId !== "string" || messageId.length === 0) {
        throw new Error(
          "SQS send did not return a MessageId; the message could not be " +
            "delivered."
        );
      }

      await assertNoItem(
        TABLES.ACTIVITY_LOG,
        activityLogCriteria(userId, eventId),
        {
          delaySeconds: 10,
          description: `activity log for user ${userId} + event ${eventId}`,
        }
      );
    }
  );
});
