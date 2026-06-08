import { describe, test, expect } from "vitest";
import {
  computePercentiles,
  computeConcentration,
} from "../../analyse-activity-log/compute-report.js";

describe("computePercentiles", () => {
  test("all same values", () => {
    const result = computePercentiles([1, 1, 1, 1, 1]);
    expect(result.mean).toBe(1);
    expect(result.median).toBe(1);
    expect(result.p75).toBe(1);
    expect(result.p90).toBe(1);
    expect(result.p95).toBe(1);
    expect(result.p99).toBe(1);
    expect(result.max).toBe(1);
  });

  test("uniform distribution 1 to 100", () => {
    const sorted = Array.from({ length: 100 }, (_, i) => i + 1);
    const result = computePercentiles(sorted);
    expect(result.mean).toBe(50.5);
    expect(result.median).toBe(50);
    expect(result.p75).toBe(75);
    expect(result.p90).toBe(90);
    expect(result.p95).toBe(95);
    expect(result.p99).toBe(99);
    expect(result.max).toBe(100);
  });

  test("outlier distribution", () => {
    const result = computePercentiles([1, 1, 1, 1, 1000]);
    expect(result.mean).toBe(200.8);
    expect(result.median).toBe(1);
    expect(result.p99).toBe(1000);
    expect(result.max).toBe(1000);
  });

  test("single user", () => {
    const result = computePercentiles([5]);
    expect(result.mean).toBe(5);
    expect(result.median).toBe(5);
    expect(result.p75).toBe(5);
    expect(result.p90).toBe(5);
    expect(result.p95).toBe(5);
    expect(result.p99).toBe(5);
    expect(result.max).toBe(5);
  });
});

describe("computeConcentration", () => {
  test("top 1 user of 100 owns 50% of items", () => {
    const counts = [50, ...new Array(99).fill(0.5)].sort(
      (a, b) => b - a
    ) as number[];
    const totalItems = 50 + 99 * 0.5;
    const result = computeConcentration(counts, totalItems);
    expect(result.top_1_pct_users_own_pct_of_items).toBe(50);
  });

  test("uniform distribution", () => {
    const counts = new Array(100).fill(10);
    const result = computeConcentration(counts, 1000);
    expect(result.top_1_pct_users_own_pct_of_items).toBe(1);
    expect(result.top_5_pct_users_own_pct_of_items).toBe(5);
    expect(result.top_10_pct_users_own_pct_of_items).toBe(10);
  });
});
