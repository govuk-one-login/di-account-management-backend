export interface PercentileResult {
  mean: number;
  median: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  max: number;
}

export interface ConcentrationResult {
  top_1_pct_users_own_pct_of_items: number;
  top_5_pct_users_own_pct_of_items: number;
  top_10_pct_users_own_pct_of_items: number;
}

const percentileAtRank = (sorted: number[], percentile: number): number => {
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
};

export const computePercentiles = (
  sortedCounts: number[]
): PercentileResult => {
  const sum = sortedCounts.reduce((a, b) => a + b, 0);
  return {
    mean: sum / sortedCounts.length,
    median: percentileAtRank(sortedCounts, 50),
    p75: percentileAtRank(sortedCounts, 75),
    p90: percentileAtRank(sortedCounts, 90),
    p95: percentileAtRank(sortedCounts, 95),
    p99: percentileAtRank(sortedCounts, 99),
    max: sortedCounts.at(-1)!,
  };
};

const topNPercentOwnership = (
  descendingCounts: number[],
  percent: number,
  totalItems: number
): number => {
  const n = Math.ceil((percent / 100) * descendingCounts.length);
  const topSum = descendingCounts.slice(0, n).reduce((a, b) => a + b, 0);
  return Math.round((topSum / totalItems) * 100);
};

export const computeConcentration = (
  descendingCounts: number[],
  totalItems: number
): ConcentrationResult => ({
  top_1_pct_users_own_pct_of_items: topNPercentOwnership(
    descendingCounts,
    1,
    totalItems
  ),
  top_5_pct_users_own_pct_of_items: topNPercentOwnership(
    descendingCounts,
    5,
    totalItems
  ),
  top_10_pct_users_own_pct_of_items: topNPercentOwnership(
    descendingCounts,
    10,
    totalItems
  ),
});

export interface UserBucket {
  user_count: number;
  total_items: number;
}

const USER_BUCKET_RANGES = [
  { label: "1", min: 1, max: 1 },
  { label: "2-5", min: 2, max: 5 },
  { label: "6-10", min: 6, max: 10 },
  { label: "11-25", min: 11, max: 25 },
  { label: "26-50", min: 26, max: 50 },
  { label: "51-100", min: 51, max: 100 },
  { label: "101-500", min: 101, max: 500 },
  { label: "501-1000", min: 501, max: 1000 },
  { label: "1001-10000", min: 1001, max: 10000 },
  { label: "10001-100000", min: 10001, max: 100000 },
  { label: "100000+", min: 100001, max: Infinity },
] as const;

export const computeUserBuckets = (
  totalCounts: number[]
): Record<string, UserBucket> => {
  const buckets: Record<string, UserBucket> = {};
  for (const { label } of USER_BUCKET_RANGES) {
    buckets[label] = { user_count: 0, total_items: 0 };
  }
  for (const count of totalCounts) {
    const range = USER_BUCKET_RANGES.find(
      (r) => count >= r.min && count <= r.max
    );
    if (range) {
      buckets[range.label].user_count++;
      buckets[range.label].total_items += count;
    }
  }
  return buckets;
};

export const AGE_BUCKET_LABELS = [
  "0-1_months",
  "1-3_months",
  "3-6_months",
  "6-12_months",
  "12-18_months",
  "18-24_months",
  "24+_months",
] as const;

export const computeItemsByAgeBucket = (
  bucketCounts: number[]
): Record<string, { count: number }> => {
  if (bucketCounts.length !== AGE_BUCKET_LABELS.length) {
    throw new Error(
      `Expected ${AGE_BUCKET_LABELS.length} age buckets, got ${bucketCounts.length}`
    );
  }
  const result: Record<string, { count: number }> = {};
  for (let i = 0; i < AGE_BUCKET_LABELS.length; i++) {
    result[AGE_BUCKET_LABELS[i]] = { count: bucketCounts[i] };
  }
  return result;
};

export interface TtlSimulationResult {
  items_removed: number;
  items_retained: number;
  pct_items_removed: number;
  users_with_all_data_removed: number;
  users_with_data_retained: number;
  items_per_user_after: PercentileResult;
}

export const computeTtlSimulation = (
  perUserCounters: number[][],
  thresholdIndex: number,
  totalItems: number
): TtlSimulationResult => {
  let itemsRemoved = 0;
  let usersWithAllDataRemoved = 0;
  const retainedCounts: number[] = [];

  for (const counters of perUserCounters) {
    const removed = counters[thresholdIndex];
    const retained = counters[0] - removed;
    itemsRemoved += removed;
    if (retained === 0) {
      usersWithAllDataRemoved++;
    } else {
      retainedCounts.push(retained);
    }
  }

  retainedCounts.sort((a, b) => a - b);

  return {
    items_removed: itemsRemoved,
    items_retained: totalItems - itemsRemoved,
    pct_items_removed: Math.round((itemsRemoved / totalItems) * 100),
    users_with_all_data_removed: usersWithAllDataRemoved,
    users_with_data_retained: perUserCounters.length - usersWithAllDataRemoved,
    items_per_user_after:
      retainedCounts.length > 0
        ? computePercentiles(retainedCounts)
        : { mean: 0, median: 0, p75: 0, p90: 0, p95: 0, p99: 0, max: 0 },
  };
};
