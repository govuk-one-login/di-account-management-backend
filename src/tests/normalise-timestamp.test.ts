import { describe, test, expect } from "vitest";
import { normaliseTimestamp } from "../common/utils.js";

describe("normaliseTimestamp", () => {
  test("returns seconds unchanged when value is in seconds range", () => {
    expect(normaliseTimestamp(1700000000)).toBe(1700000000);
  });

  test("converts milliseconds to seconds", () => {
    expect(normaliseTimestamp(1700000000000)).toBe(1700000000);
  });

  test("handles boundary value at threshold", () => {
    expect(normaliseTimestamp(9999999999)).toBe(9999999999);
    expect(normaliseTimestamp(10000000000)).toBe(10000000000);
    expect(normaliseTimestamp(10000000000000)).toBe(10000000000);
  });

  test("floors fractional seconds after conversion", () => {
    expect(normaliseTimestamp(1700000000123)).toBe(1700000000);
  });
});
