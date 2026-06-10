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

export const computePercentilesFromFrequency = (
  frequency: Record<number, number>
): PercentileResult => {
  const entries = Object.entries(frequency)
    .map(([k, v]) => [Number(k), v] as [number, number])
    .sort((a, b) => a[0] - b[0]);

  let totalUsers = 0;
  let totalItems = 0;
  for (const [count, users] of entries) {
    totalUsers += users;
    totalItems += count * users;
  }

  const percentileFromEntries = (percentile: number): number => {
    const rank = Math.ceil((percentile / 100) * totalUsers);
    let cumulative = 0;
    for (const [count, users] of entries) {
      cumulative += users;
      if (cumulative >= rank) return count;
    }
    return entries.at(-1)![0];
  };

  return {
    mean: totalItems / totalUsers,
    median: percentileFromEntries(50),
    p75: percentileFromEntries(75),
    p90: percentileFromEntries(90),
    p95: percentileFromEntries(95),
    p99: percentileFromEntries(99),
    max: entries.at(-1)![0],
  };
};

export const computeConcentrationFromFrequency = (
  frequency: Record<number, number>
): ConcentrationResult => {
  const entries = Object.entries(frequency)
    .map(([k, v]) => [Number(k), v] as [number, number])
    .sort((a, b) => b[0] - a[0]);

  let totalUsers = 0;
  let totalItems = 0;
  for (const [count, users] of entries) {
    totalUsers += users;
    totalItems += count * users;
  }

  const topNPct = (percent: number): number => {
    const n = Math.ceil((percent / 100) * totalUsers);
    let usersAccum = 0;
    let itemsAccum = 0;
    for (const [count, users] of entries) {
      const take = Math.min(users, n - usersAccum);
      itemsAccum += count * take;
      usersAccum += take;
      if (usersAccum >= n) break;
    }
    return Math.round((itemsAccum / totalItems) * 100);
  };

  return {
    top_1_pct_users_own_pct_of_items: topNPct(1),
    top_5_pct_users_own_pct_of_items: topNPct(5),
    top_10_pct_users_own_pct_of_items: topNPct(10),
  };
};

export const computeUserBucketsFromFrequency = (
  frequency: Record<number, number>
): Record<string, UserBucket> => {
  const buckets: Record<string, UserBucket> = {};
  for (const { label } of USER_BUCKET_RANGES) {
    buckets[label] = { user_count: 0, total_items: 0 };
  }
  for (const [countStr, users] of Object.entries(frequency)) {
    const count = Number(countStr);
    const range = USER_BUCKET_RANGES.find(
      (r) => count >= r.min && count <= r.max
    );
    if (range) {
      buckets[range.label].user_count += users;
      buckets[range.label].total_items += count * users;
    }
  }
  return buckets;
};

export const computeTtlSimulationFromFrequency = (
  retainedFrequency: Record<number, number>,
  usersFullyRemoved: number,
  totalItems: number,
  totalUsers: number
): TtlSimulationResult => {
  let itemsRetained = 0;
  for (const [count, users] of Object.entries(retainedFrequency)) {
    itemsRetained += Number(count) * users;
  }
  const itemsRemoved = totalItems - itemsRetained;

  const hasRetained = Object.keys(retainedFrequency).length > 0;

  return {
    items_removed: itemsRemoved,
    items_retained: itemsRetained,
    pct_items_removed: Math.round((itemsRemoved / totalItems) * 100),
    users_with_all_data_removed: usersFullyRemoved,
    users_with_data_retained: totalUsers - usersFullyRemoved,
    items_per_user_after: hasRetained
      ? computePercentilesFromFrequency(retainedFrequency)
      : { mean: 0, median: 0, p75: 0, p90: 0, p95: 0, p99: 0, max: 0 },
  };
};
