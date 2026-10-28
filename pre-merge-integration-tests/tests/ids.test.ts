// Unit tests for the ID generators used by the pre-merge integration suite.

import { describe, expect, it } from "vitest";

import { generateEventId, generateUserId } from "../ids.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("generateUserId", () => {
  it("formats the id as premerge-{testName}-{8 hex chars}", () => {
    const id = generateUserId("auth-code-issued");
    expect(id).toMatch(/^premerge-auth-code-issued-[0-9a-f]{8}$/);
  });

  it("includes the supplied test name verbatim", () => {
    expect(generateUserId("my_test")).toContain("premerge-my_test-");
  });

  it("produces a unique suffix on each call", () => {
    const ids = new Set(
      Array.from({ length: 50 }, () => generateUserId("dup"))
    );
    expect(ids.size).toBe(50);
  });
});

describe("generateEventId", () => {
  it("returns a valid v4-style UUID", () => {
    expect(generateEventId()).toMatch(UUID_REGEX);
  });

  it("produces a unique value on each call", () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateEventId()));
    expect(ids.size).toBe(50);
  });
});
