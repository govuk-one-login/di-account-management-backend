// Builds TxMA events like the ones the raw events Lambda (save-raw-events)
// accepts. Used by send-event.ts. Kept free of AWS calls so it can be tested.

import { randomUUID } from "node:crypto";

export interface EventSpec {
  name: string;
  /** What the event is for, shown in the menu. */
  description: string;
  /** save-raw-events rejects the event if these are missing. */
  requiresSessionId: boolean;
  requiresUserId: boolean;
  requiresClientId: boolean;
  defaultClientId?: string;
}

// Keep in step with ALLOWED_EVENT_NAMES in src/save-raw-events.ts (a test
// checks this).
export const EVENTS: EventSpec[] = [
  {
    name: "AUTH_AUTH_CODE_ISSUED",
    description: "user signed in to a service",
    requiresSessionId: true,
    requiresUserId: true,
    requiresClientId: true,
    defaultClientId: "vehicleOperatorLicense",
  },
  {
    name: "AUTH_TOKEN_SENT_TO_ORCHESTRATION",
    description: "creates/refreshes the inactive account tracker record",
    requiresSessionId: false,
    requiresUserId: true,
    requiresClientId: true,
    defaultClientId: "orchestrationAuth",
  },
  {
    name: "AUTH_CODE_VERIFIED",
    description: "MFA code verified (tracker); user may be missing",
    requiresSessionId: true,
    requiresUserId: false,
    requiresClientId: false,
    defaultClientId: "oneLoginHome",
  },
  {
    name: "AUTH_PASSKEY_VERIFICATION_SUCCESSFUL",
    description: "passkey sign-in (tracker)",
    requiresSessionId: true,
    requiresUserId: true,
    requiresClientId: true,
    defaultClientId: "oneLoginHome",
  },
  {
    name: "STS_REFRESH_TOKEN_ISSUED",
    description: "GOV.UK app refresh token (tracker, only if a record exists)",
    requiresSessionId: true,
    requiresUserId: true,
    requiresClientId: false,
  },
  {
    name: "AUTH_UPDATE_EMAIL",
    description: "user changed their email address",
    requiresSessionId: false,
    requiresUserId: true,
    requiresClientId: false,
    defaultClientId: "oneLoginHome",
  },
  {
    name: "AUTH_DELETE_ACCOUNT",
    description: "account deleted",
    requiresSessionId: false,
    requiresUserId: true,
    requiresClientId: false,
  },
  {
    name: "AUTH_IPV_AUTHORISATION_REQUESTED",
    description: "identity check started",
    requiresSessionId: true,
    requiresUserId: true,
    requiresClientId: true,
    defaultClientId: "vehicleOperatorLicense",
  },
  {
    name: "AUTH_IPV_SUCCESSFUL_IDENTITY_RESPONSE_RECEIVED",
    description: "identity check passed",
    requiresSessionId: true,
    requiresUserId: true,
    requiresClientId: true,
    defaultClientId: "vehicleOperatorLicense",
  },
];

export interface EventAnswers {
  eventName: string;
  userId?: string;
  sessionId?: string;
  clientId?: string;
  email?: string;
  publicSubjectId?: string;
  /** Unix seconds. */
  timestamp: number;
  /** Merged into the event (objects are merged recursively). */
  extra?: Record<string, unknown>;
}

type Json = Record<string, unknown>;

const isPlainObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const deepMerge = (base: Json, extra: Json): Json => {
  const merged: Json = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    const existing = merged[key];
    merged[key] =
      isPlainObject(existing) && isPlainObject(value)
        ? deepMerge(existing, value)
        : value;
  }
  return merged;
};

/** Empty strings are left out, as a missing field is what the handler checks. */
export const buildEvent = (answers: EventAnswers): Json => {
  const timestampMs = answers.timestamp * 1000;
  const user: Json = {
    ...(answers.userId && { user_id: answers.userId }),
    ...(answers.sessionId && { session_id: answers.sessionId }),
    ...(answers.email && { email: answers.email }),
    ...(answers.publicSubjectId && {
      public_subject_id: answers.publicSubjectId,
    }),
  };
  const event: Json = {
    event_name: answers.eventName,
    event_id: randomUUID(),
    timestamp: answers.timestamp,
    timestamp_formatted: new Date(timestampMs).toISOString(),
    event_timestamp_ms: timestampMs,
    component_id: "AUTH",
    ...(answers.clientId && { client_id: answers.clientId }),
    user,
  };
  return answers.extra ? deepMerge(event, answers.extra) : event;
};

/**
 * Accepts nothing (now), unix seconds or milliseconds, or anything Date can
 * parse such as 2024-11-05T10:00:00Z. Returns unix seconds.
 */
export const parseTimestamp = (
  input: string,
  now: () => number = Date.now
): number => {
  const text = input.trim();
  if (text === "" || text === "now") return Math.floor(now() / 1000);
  if (/^\d+$/.test(text)) {
    const value = Number(text);
    // 13 digits or more is milliseconds.
    return text.length >= 13 ? Math.floor(value / 1000) : value;
  }
  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) {
    throw new Error(`Cannot read "${input}" as a time`);
  }
  return Math.floor(parsed / 1000);
};

export const parseExtra = (input: string): Json | undefined => {
  const text = input.trim();
  if (text === "") return undefined;
  const parsed: unknown = JSON.parse(text);
  if (!isPlainObject(parsed)) {
    throw new Error('Expected a JSON object, e.g. {"extensions":{}}');
  }
  return parsed;
};
