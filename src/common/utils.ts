import { CurrentTimeDescriptor } from "./model";

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
