export type AgeThresholds = [number, number, number, number, number, number];

const AGE_OFFSETS_MONTHS = [1, 3, 6, 12, 18, 24] as const;

export const CounterIndex = {
  TOTAL: 0,
  OLDER_1M: 1,
  OLDER_3M: 2,
  OLDER_6M: 3,
  OLDER_12M: 4,
  OLDER_18M: 5,
  OLDER_24M: 6,
} as const;

type CounterIndexValue = (typeof CounterIndex)[keyof typeof CounterIndex];

export const ageThresholdsFromNow = (nowSeconds: number): AgeThresholds =>
  AGE_OFFSETS_MONTHS.map(
    (months) =>
      nowSeconds - months * (30 * 24 * 60 * 60) /* seconds per month */
  ) as unknown as AgeThresholds;

export const getAgeCounterIndex = (
  ts: number,
  thresholds: AgeThresholds
): CounterIndexValue => {
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (ts <= thresholds[i]) {
      return (i + 1) as CounterIndexValue;
    }
  }
  return CounterIndex.TOTAL;
};

export const incrementCounters = (
  counters: number[],
  upToAndIncludingAgeCounterIndex: number
): void => {
  for (let i = 0; i <= upToAndIncludingAgeCounterIndex; i++) {
    counters[i]++;
  }
};
