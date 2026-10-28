import { randomUUID } from "node:crypto";

// Returns `premerge-{testName}-{first 8 chars of a uuid}`.
export function generateUserId(testName: string): string {
  const shortUuid = randomUUID().slice(0, 8);
  return `premerge-${testName}-${shortUuid}`;
}

export function generateEventId(): string {
  return randomUUID();
}
