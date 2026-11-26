import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SRC_DIR } from "../config.ts";
import {
  buildEvent,
  deepMerge,
  EVENTS,
  parseExtra,
  parseTimestamp,
} from "../txma.ts";

describe("EVENTS", () => {
  it("only offers events that save-raw-events accepts, and all of them", () => {
    const source = readFileSync(join(SRC_DIR, "save-raw-events.ts"), "utf8");
    const allowed = source
      .slice(
        source.indexOf("ALLOWED_EVENT_NAMES"),
        source.indexOf("]);", source.indexOf("ALLOWED_EVENT_NAMES"))
      )
      .match(/"([A-Z_]+)"/g)!
      .map((name) => name.replaceAll('"', ""));
    expect(EVENTS.map((e) => e.name).sort()).toEqual([...allowed].sort());
  });
});

describe("buildEvent", () => {
  it("builds an event with the fields save-raw-events validates", () => {
    const event = buildEvent({
      eventName: "AUTH_AUTH_CODE_ISSUED",
      userId: "u1",
      sessionId: "s1",
      clientId: "c1",
      email: "u1@example.com",
      timestamp: 1730800548,
    });
    expect(event).toMatchObject({
      event_name: "AUTH_AUTH_CODE_ISSUED",
      timestamp: 1730800548,
      event_timestamp_ms: 1730800548000,
      client_id: "c1",
      user: { user_id: "u1", session_id: "s1", email: "u1@example.com" },
    });
    expect(typeof event.event_id).toBe("string");
  });

  it("leaves out blank fields", () => {
    const event = buildEvent({
      eventName: "AUTH_DELETE_ACCOUNT",
      userId: "u1",
      sessionId: "",
      clientId: "",
      timestamp: 1,
    });
    expect(event).not.toHaveProperty("client_id");
    expect(event.user).toEqual({ user_id: "u1" });
  });

  it("gives each event its own id", () => {
    const answers = { eventName: "X", timestamp: 1 };
    expect(buildEvent(answers).event_id).not.toBe(buildEvent(answers).event_id);
  });

  it("merges extra fields into nested objects", () => {
    const event = buildEvent({
      eventName: "AUTH_CODE_VERIFIED",
      userId: "u1",
      timestamp: 1,
      extra: {
        extensions: { "journey-type": "PASSWORD_RESET" },
        user: { govuk_signin_journey_id: "j1" },
      },
    });
    expect(event.extensions).toEqual({ "journey-type": "PASSWORD_RESET" });
    expect(event.user).toEqual({
      user_id: "u1",
      govuk_signin_journey_id: "j1",
    });
  });
});

describe("deepMerge", () => {
  it("replaces non-objects and merges objects", () => {
    expect(deepMerge({ a: 1, b: { c: 1 } }, { a: 2, b: { d: 2 } })).toEqual({
      a: 2,
      b: { c: 1, d: 2 },
    });
  });
});

describe("parseTimestamp", () => {
  const now = () => 1_700_000_000_000;

  it("defaults to now", () => {
    expect(parseTimestamp("", now)).toBe(1_700_000_000);
    expect(parseTimestamp("now", now)).toBe(1_700_000_000);
  });

  it("reads seconds, milliseconds and dates", () => {
    expect(parseTimestamp("1730800548")).toBe(1730800548);
    expect(parseTimestamp("1730800548523")).toBe(1730800548);
    expect(parseTimestamp("2024-11-05T10:15:48Z")).toBe(1730801748);
  });

  it("rejects nonsense", () => {
    expect(() => parseTimestamp("tomorrow-ish")).toThrow(/Cannot read/);
  });
});

describe("parseExtra", () => {
  it("returns undefined for blank, an object for JSON", () => {
    expect(parseExtra("  ")).toBeUndefined();
    expect(parseExtra('{"a":1}')).toEqual({ a: 1 });
  });

  it("rejects arrays and invalid JSON", () => {
    expect(() => parseExtra("[1]")).toThrow(/JSON object/);
    expect(() => parseExtra("{nope")).toThrow();
  });
});
