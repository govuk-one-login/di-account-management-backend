import { CounterIndex } from "./age-thresholds.js";

export interface ChunkResult {
  totalCountFrequency: Record<number, number>;
  ageBuckets: number[];
  ttlRetainedFrequency: Record<string, Record<number, number>>;
  usersFullyRemovedByTtl: Record<string, number>;
}

const TTL_THRESHOLDS = [
  { key: "3_months", index: CounterIndex.OLDER_3M },
  { key: "6_months", index: CounterIndex.OLDER_6M },
  { key: "12_months", index: CounterIndex.OLDER_12M },
  { key: "18_months", index: CounterIndex.OLDER_18M },
  { key: "24_months", index: CounterIndex.OLDER_24M },
] as const;

export const buildChunkResult = (
  perUserCounters: number[][],
  exclusiveAgeBuckets: number[]
): ChunkResult => {
  const totalCountFrequency: Record<number, number> = {};
  const ttlRetainedFrequency: Record<string, Record<number, number>> = {};
  const usersFullyRemovedByTtl: Record<string, number> = {};

  for (const { key } of TTL_THRESHOLDS) {
    ttlRetainedFrequency[key] = {};
    usersFullyRemovedByTtl[key] = 0;
  }

  for (const counters of perUserCounters) {
    const total = counters[CounterIndex.TOTAL];
    totalCountFrequency[total] = (totalCountFrequency[total] ?? 0) + 1;

    for (const { key, index } of TTL_THRESHOLDS) {
      const retained = total - counters[index];
      if (retained === 0) {
        usersFullyRemovedByTtl[key]++;
      } else {
        ttlRetainedFrequency[key][retained] =
          (ttlRetainedFrequency[key][retained] ?? 0) + 1;
      }
    }
  }

  return {
    totalCountFrequency,
    ageBuckets: exclusiveAgeBuckets,
    ttlRetainedFrequency,
    usersFullyRemovedByTtl,
  };
};

const mergeFrequencyMaps = (
  a: Record<number, number>,
  b: Record<number, number>
): Record<number, number> => {
  const result = { ...a };
  for (const [key, value] of Object.entries(b)) {
    const k = Number(key);
    result[k] = (result[k] ?? 0) + value;
  }
  return result;
};

export const mergeChunkResults = (
  a: ChunkResult,
  b: ChunkResult
): ChunkResult => {
  const ageBuckets = a.ageBuckets.map((v, i) => v + b.ageBuckets[i]);

  const ttlRetainedFrequency: Record<string, Record<number, number>> = {};
  const usersFullyRemovedByTtl: Record<string, number> = {};

  for (const { key } of TTL_THRESHOLDS) {
    ttlRetainedFrequency[key] = mergeFrequencyMaps(
      a.ttlRetainedFrequency[key],
      b.ttlRetainedFrequency[key]
    );
    usersFullyRemovedByTtl[key] =
      a.usersFullyRemovedByTtl[key] + b.usersFullyRemovedByTtl[key];
  }

  return {
    totalCountFrequency: mergeFrequencyMaps(
      a.totalCountFrequency,
      b.totalCountFrequency
    ),
    ageBuckets,
    ttlRetainedFrequency,
    usersFullyRemovedByTtl,
  };
};

export const emptyChunkResult = (numAgeBuckets: number): ChunkResult => {
  const ttlRetainedFrequency: Record<string, Record<number, number>> = {};
  const usersFullyRemovedByTtl: Record<string, number> = {};
  for (const { key } of TTL_THRESHOLDS) {
    ttlRetainedFrequency[key] = {};
    usersFullyRemovedByTtl[key] = 0;
  }
  return {
    totalCountFrequency: {},
    ageBuckets: new Array(numAgeBuckets).fill(0),
    ttlRetainedFrequency,
    usersFullyRemovedByTtl,
  };
};
