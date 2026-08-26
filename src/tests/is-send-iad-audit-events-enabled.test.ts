import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { isSendIadAuditEventsEnabled } from "../common/utils.js";

const ENV_VAR = "FEATURE_SEND_IAD_AUDIT_EVENTS";

describe("isSendIadAuditEventsEnabled", () => {
  const originalValue = process.env[ENV_VAR];

  beforeEach(() => {
    delete process.env[ENV_VAR];
  });

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env[ENV_VAR];
    } else {
      process.env[ENV_VAR] = originalValue;
    }
  });

  test("returns true when set to \"true\"", () => {
    process.env[ENV_VAR] = "true";
    expect(isSendIadAuditEventsEnabled()).toBe(true);
  });

  test("returns true regardless of casing", () => {
    process.env[ENV_VAR] = "TRUE";
    expect(isSendIadAuditEventsEnabled()).toBe(true);
    process.env[ENV_VAR] = "True";
    expect(isSendIadAuditEventsEnabled()).toBe(true);
  });

  test("returns false when set to \"false\"", () => {
    process.env[ENV_VAR] = "false";
    expect(isSendIadAuditEventsEnabled()).toBe(false);
  });

  test("returns false for any non-\"true\" value", () => {
    process.env[ENV_VAR] = "1";
    expect(isSendIadAuditEventsEnabled()).toBe(false);
    process.env[ENV_VAR] = "yes";
    expect(isSendIadAuditEventsEnabled()).toBe(false);
    process.env[ENV_VAR] = "";
    expect(isSendIadAuditEventsEnabled()).toBe(false);
  });

  test("returns false when the environment variable is not set", () => {
    expect(isSendIadAuditEventsEnabled()).toBe(false);
  });
});
