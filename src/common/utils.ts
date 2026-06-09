import { CurrentTimeDescriptor } from "./model.js";

/**
 * A function for calculating and returning an object containing the current timestamp.
 *
 * @returns CurrentTimeDescriptor object, containing different formats of the current time
 */
export function getCurrentTimestamp(date = new Date()): CurrentTimeDescriptor {
  return {
    milliseconds: date.valueOf(),
    isoString: date.toISOString(),
    seconds: Math.floor(date.valueOf() / 1000),
  };
}

/**
 * Retrieves the value of an environment variable and throws an error if it is not set.
 *
 * @param name - The name of the environment variable.
 * @returns The value of the environment variable.
 * @throws Will throw an error if the environment variable is not set.
 */
export function getEnvironmentVariable(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable "${name}" is not set.`);
  }
  return value;
}

export const zeroedArray = (length: number): number[] =>
  new Array(length).fill(0);

const MILLISECOND_THRESHOLD = 1_000_000_000_000;

/**
 * Normalises a timestamp to seconds, handling both seconds and milliseconds formats.
 *
 * Values >= 1_000_000_000_000 are treated as milliseconds and divided by 1000.
 * Values below this threshold are assumed to already be in seconds.
 *
 * @example
 * normaliseTimestamp(1_700_000_000)     // seconds → 1_700_000_000
 * normaliseTimestamp(1_700_000_000_000) // milliseconds → 1_700_000_000
 *
 * @param value - Epoch timestamp in either seconds or milliseconds
 * @returns Epoch timestamp in seconds (floored)
 */
export const normaliseTimestamp = (value: number): number =>
  value >= MILLISECOND_THRESHOLD ? Math.floor(value / 1000) : value;
