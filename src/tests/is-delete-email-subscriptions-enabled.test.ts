import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { isDeleteEmailSubscriptionsEnabled } from "../common/utils.js";

const ENV_VAR = "FEATURE_DELETE_EMAIL_SUBSCRIPTIONS";

describe("isDeleteEmailSubscriptionsEnabled", () => {
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
    expect(isDeleteEmailSubscriptionsEnabled()).toBe(true);
  });

  test("returns true regardless of casing", () => {
    process.env[ENV_VAR] = "TRUE";
    expect(isDeleteEmailSubscriptionsEnabled()).toBe(true);
    process.env[ENV_VAR] = "True";
    expect(isDeleteEmailSubscriptionsEnabled()).toBe(true);
  });

  test("returns false when set to \"false\"", () => {
    process.env[ENV_VAR] = "false";
    expect(isDeleteEmailSubscriptionsEnabled()).toBe(false);
  });

  test("returns false for any non-\"true\" value", () => {
    process.env[ENV_VAR] = "1";
    expect(isDeleteEmailSubscriptionsEnabled()).toBe(false);
    process.env[ENV_VAR] = "yes";
    expect(isDeleteEmailSubscriptionsEnabled()).toBe(false);
  });

  test("throws when the environment variable is set to an empty string", () => {
    process.env[ENV_VAR] = "";
    expect(() => isDeleteEmailSubscriptionsEnabled()).toThrowError(
      `Environment variable "${ENV_VAR}" is not set.`
    );
  });

  test("throws when the environment variable is not set", () => {
    expect(() => isDeleteEmailSubscriptionsEnabled()).toThrowError(
      `Environment variable "${ENV_VAR}" is not set.`
    );
  });
});
