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
