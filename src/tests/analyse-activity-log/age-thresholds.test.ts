import { describe, test, expect } from "vitest";
import {
  ageThresholdsFromNow,
  getAgeCounterIndex,
  incrementCounters,
  CounterIndex,
} from "../../analyse-activity-log/age-thresholds.js";

const NOW_SECONDS = 1700000000;

describe("ageThresholdsFromNow", () => {
  test("returns 6 thresholds in descending order", () => {
    const thresholds = ageThresholdsFromNow(NOW_SECONDS);
    expect(thresholds).toHaveLength(6);
    for (let i = 0; i < thresholds.length - 1; i++) {
      expect(thresholds[i]).toBeGreaterThan(thresholds[i + 1]);
    }
  });

  test("first threshold is 1 month before now", () => {
    const thresholds = ageThresholdsFromNow(NOW_SECONDS);
    expect(thresholds[0]).toBe(NOW_SECONDS - 30 * 24 * 60 * 60);
  });

  test("last threshold is 24 months before now", () => {
    const thresholds = ageThresholdsFromNow(NOW_SECONDS);
    expect(thresholds[5]).toBe(NOW_SECONDS - 24 * 30 * 24 * 60 * 60);
  });
});

describe("getAgeCounterIndex", () => {
  test("returns 0 for timestamp newer than all thresholds", () => {
    const thresholds = ageThresholdsFromNow(NOW_SECONDS);
    expect(getAgeCounterIndex(NOW_SECONDS, thresholds)).toBe(
      CounterIndex.TOTAL
    );
  });

  test("returns OLDER_1M for timestamp exactly at 1-month threshold", () => {
    const thresholds = ageThresholdsFromNow(NOW_SECONDS);
    expect(getAgeCounterIndex(thresholds[0], thresholds)).toBe(
      CounterIndex.OLDER_1M
    );
  });

  test("returns OLDER_6M for timestamp between 6 and 12 months", () => {
    const thresholds = ageThresholdsFromNow(NOW_SECONDS);
    expect(getAgeCounterIndex(thresholds[2] - 1, thresholds)).toBe(
      CounterIndex.OLDER_6M
    );
  });

  test("returns OLDER_24M for timestamp older than all thresholds", () => {
    const thresholds = ageThresholdsFromNow(NOW_SECONDS);
    expect(getAgeCounterIndex(thresholds[5] - 1, thresholds)).toBe(
      CounterIndex.OLDER_24M
    );
  });
});

describe("incrementCounters", () => {
  test("increments only index 0 for bucket 0", () => {
    const counters = [0, 0, 0, 0, 0, 0, 0];
    incrementCounters(counters, 0);
    expect(counters).toEqual([1, 0, 0, 0, 0, 0, 0]);
  });

  test("increments indices 0 through bucket", () => {
    const counters = [0, 0, 0, 0, 0, 0, 0];
    incrementCounters(counters, 3);
    expect(counters).toEqual([1, 1, 1, 1, 0, 0, 0]);
  });

  test("increments all for bucket 6", () => {
    const counters = [0, 0, 0, 0, 0, 0, 0];
    incrementCounters(counters, 6);
    expect(counters).toEqual([1, 1, 1, 1, 1, 1, 1]);
  });
});
