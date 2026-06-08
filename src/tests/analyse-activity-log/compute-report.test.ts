import { describe, test, expect } from "vitest";
import {
  computePercentiles,
  computeConcentration,
  computeUserBuckets,
  computeItemsByAgeBucket,
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

describe("computeUserBuckets", () => {
  test("classifies boundary values correctly", () => {
    const counts = [
      1, 5, 6, 10, 11, 25, 26, 50, 51, 100, 101, 500, 501, 1000, 1001, 10000,
      10001, 100000, 100001,
    ];
    const result = computeUserBuckets(counts);
    expect(result["1"].user_count).toBe(1);
    expect(result["2-5"].user_count).toBe(1);
    expect(result["6-10"].user_count).toBe(2);
    expect(result["11-25"].user_count).toBe(2);
    expect(result["26-50"].user_count).toBe(2);
    expect(result["51-100"].user_count).toBe(2);
    expect(result["101-500"].user_count).toBe(2);
    expect(result["501-1000"].user_count).toBe(2);
    expect(result["1001-10000"].user_count).toBe(2);
    expect(result["10001-100000"].user_count).toBe(2);
    expect(result["100000+"].user_count).toBe(1);
  });

  test("sums total_items per bucket", () => {
    const counts = [1, 3, 4];
    const result = computeUserBuckets(counts);
    expect(result["1"].total_items).toBe(1);
    expect(result["2-5"].total_items).toBe(7);
  });
});

describe("computeItemsByAgeBucket", () => {
  test("labels match expected output keys", () => {
    const buckets = [100, 200, 300, 400, 500, 600, 700];
    const result = computeItemsByAgeBucket(buckets);
    expect(result["0-1_months"].count).toBe(100);
    expect(result["1-3_months"].count).toBe(200);
    expect(result["3-6_months"].count).toBe(300);
    expect(result["6-12_months"].count).toBe(400);
    expect(result["12-18_months"].count).toBe(500);
    expect(result["18-24_months"].count).toBe(600);
    expect(result["24+_months"].count).toBe(700);
  });

  test("throws when bucket count does not match label count", () => {
    expect(() => computeItemsByAgeBucket([1, 2, 3])).toThrow(
      "Expected 7 age buckets, got 3"
    );
  });
});
