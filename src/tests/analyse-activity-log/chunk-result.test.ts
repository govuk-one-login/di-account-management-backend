import { describe, test, expect } from "vitest";
import {
  buildChunkResult,
  mergeChunkResults,
  emptyChunkResult,
} from "../../analyse-activity-log/chunk-result.js";

describe("buildChunkResult", () => {
  test("builds frequency map from per-user counters", () => {
    const perUserCounters = [
      [3, 1, 0, 0, 0, 0, 0],
      [3, 2, 1, 0, 0, 0, 0],
      [5, 4, 3, 2, 1, 0, 0],
    ];
    const ageBuckets = [4, 3, 2, 1, 1, 0, 0];

    const result = buildChunkResult(perUserCounters, ageBuckets);

    expect(result.totalCountFrequency).toEqual({ 3: 2, 5: 1 });
    expect(result.ageBuckets).toEqual([4, 3, 2, 1, 1, 0, 0]);
  });

  test("builds TTL retained frequency correctly", () => {
    const perUserCounters = [
      [10, 10, 10, 5, 0, 0, 0],
      [6, 4, 2, 0, 0, 0, 0],
    ];
    const ageBuckets = [0, 0, 0, 0, 0, 0, 0];

    const result = buildChunkResult(perUserCounters, ageBuckets);

    expect(result.usersFullyRemovedByTtl["3_months"]).toBe(1);
    expect(result.ttlRetainedFrequency["3_months"]).toEqual({ 4: 1 });
  });

  test("empty counters produce empty result", () => {
    const result = buildChunkResult([], [0, 0, 0, 0, 0, 0, 0]);
    expect(result.totalCountFrequency).toEqual({});
  });
});

describe("mergeChunkResults", () => {
  test("merges frequency maps additively", () => {
    const a = buildChunkResult([[3, 1, 0, 0, 0, 0, 0]], [2, 1, 0, 0, 0, 0, 0]);
    const b = buildChunkResult(
      [
        [3, 2, 1, 0, 0, 0, 0],
        [5, 3, 2, 1, 0, 0, 0],
      ],
      [3, 2, 1, 1, 0, 0, 0]
    );

    const merged = mergeChunkResults(a, b);

    expect(merged.totalCountFrequency).toEqual({ 3: 2, 5: 1 });
    expect(merged.ageBuckets).toEqual([5, 3, 1, 1, 0, 0, 0]);
  });

  test("merges TTL data", () => {
    const a = buildChunkResult(
      [[10, 10, 10, 0, 0, 0, 0]],
      [0, 0, 0, 0, 0, 0, 0]
    );
    const b = buildChunkResult([[5, 3, 0, 0, 0, 0, 0]], [0, 0, 0, 0, 0, 0, 0]);

    const merged = mergeChunkResults(a, b);

    expect(merged.usersFullyRemovedByTtl["3_months"]).toBe(1);
    expect(merged.ttlRetainedFrequency["3_months"]).toEqual({ 5: 1 });
  });
});

describe("emptyChunkResult", () => {
  test("produces zeroed result", () => {
    const result = emptyChunkResult(7);
    expect(result.totalCountFrequency).toEqual({});
    expect(result.ageBuckets).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(result.usersFullyRemovedByTtl["3_months"]).toBe(0);
  });
});
