import { describe, test, expect } from "vitest";
import {
  computeItemsByAgeBucket,
  computePercentilesFromFrequency,
  computeConcentrationFromFrequency,
  computeUserBucketsFromFrequency,
  computeTtlSimulationFromFrequency,
} from "../../analyse-activity-log/compute-report.js";

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

describe("computePercentilesFromFrequency", () => {
  test("uniform distribution 1 to 100", () => {
    const frequency: Record<number, number> = {};
    for (let i = 1; i <= 100; i++) frequency[i] = 1;
    const result = computePercentilesFromFrequency(frequency);
    expect(result.mean).toBe(50.5);
    expect(result.median).toBe(50);
    expect(result.p75).toBe(75);
    expect(result.p90).toBe(90);
    expect(result.p95).toBe(95);
    expect(result.p99).toBe(99);
    expect(result.max).toBe(100);
  });

  test("all same values", () => {
    const result = computePercentilesFromFrequency({ 1: 5 });
    expect(result.mean).toBe(1);
    expect(result.median).toBe(1);
    expect(result.p75).toBe(1);
    expect(result.p90).toBe(1);
    expect(result.p95).toBe(1);
    expect(result.p99).toBe(1);
    expect(result.max).toBe(1);
  });

  test("outlier distribution", () => {
    const result = computePercentilesFromFrequency({ 1: 4, 1000: 1 });
    expect(result.mean).toBe(200.8);
    expect(result.median).toBe(1);
    expect(result.p99).toBe(1000);
    expect(result.max).toBe(1000);
  });

  test("single user", () => {
    const result = computePercentilesFromFrequency({ 5: 1 });
    expect(result.mean).toBe(5);
    expect(result.median).toBe(5);
    expect(result.p75).toBe(5);
    expect(result.p90).toBe(5);
    expect(result.p95).toBe(5);
    expect(result.p99).toBe(5);
    expect(result.max).toBe(5);
  });
});

describe("computeConcentrationFromFrequency", () => {
  test("uniform distribution", () => {
    const result = computeConcentrationFromFrequency({ 10: 100 });
    expect(result.top_1_pct_users_own_pct_of_items).toBe(1);
    expect(result.top_5_pct_users_own_pct_of_items).toBe(5);
    expect(result.top_10_pct_users_own_pct_of_items).toBe(10);
  });

  test("top 1 user of 100 owns 50% of items", () => {
    // 1 user with 50 items, 99 users with 1 item each = 149 total
    const frequency = { 50: 1, 1: 99 };
    const result = computeConcentrationFromFrequency(frequency);
    expect(result.top_1_pct_users_own_pct_of_items).toBe(34);
  });
});

describe("computeUserBucketsFromFrequency", () => {
  test("classifies boundary values correctly", () => {
    const frequency = {
      1: 1,
      5: 1,
      6: 1,
      10: 1,
      11: 1,
      25: 1,
      26: 1,
      50: 1,
      51: 1,
      100: 1,
      101: 1,
      500: 1,
      501: 1,
      1000: 1,
      1001: 1,
      10000: 1,
      10001: 1,
      100000: 1,
      100001: 1,
    };
    const result = computeUserBucketsFromFrequency(frequency);
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
    const frequency = { 1: 1, 3: 1, 4: 1 };
    const result = computeUserBucketsFromFrequency(frequency);
    expect(result["1"].total_items).toBe(1);
    expect(result["2-5"].total_items).toBe(7);
  });
});

describe("computeTtlSimulationFromFrequency", () => {
  test("user with all items removed", () => {
    const result = computeTtlSimulationFromFrequency({}, 1, 5, 1);
    expect(result.items_removed).toBe(5);
    expect(result.items_retained).toBe(0);
    expect(result.pct_items_removed).toBe(100);
    expect(result.users_with_all_data_removed).toBe(1);
    expect(result.users_with_data_retained).toBe(0);
  });

  test("user with no items removed", () => {
    const result = computeTtlSimulationFromFrequency({ 5: 1 }, 0, 5, 1);
    expect(result.items_removed).toBe(0);
    expect(result.items_retained).toBe(5);
    expect(result.pct_items_removed).toBe(0);
    expect(result.users_with_all_data_removed).toBe(0);
    expect(result.users_with_data_retained).toBe(1);
    expect(result.items_per_user_after.mean).toBe(5);
  });

  test("mixed removal across users", () => {
    // 1 user fully removed, 2 users retain 5 items each
    const result = computeTtlSimulationFromFrequency({ 5: 2 }, 1, 20, 3);
    expect(result.items_removed).toBe(10);
    expect(result.items_retained).toBe(10);
    expect(result.pct_items_removed).toBe(50);
    expect(result.users_with_all_data_removed).toBe(1);
    expect(result.users_with_data_retained).toBe(2);
    expect(result.items_per_user_after.mean).toBe(5);
  });

  test("post-TTL percentiles exclude fully-removed users", () => {
    // 1 fully removed, 1 retains 5, 1 retains 6
    const result = computeTtlSimulationFromFrequency({ 5: 1, 6: 1 }, 1, 23, 3);
    expect(result.users_with_all_data_removed).toBe(1);
    expect(result.users_with_data_retained).toBe(2);
    expect(result.items_per_user_after.mean).toBe(5.5);
    expect(result.items_per_user_after.max).toBe(6);
  });
});
