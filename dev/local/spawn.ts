// Runs invoke.ts in a child process, because some handler modules read their
// configuration when they are first imported, so each invocation needs a fresh
// process.

import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { REPO_ROOT } from "./config.ts";

export interface ChildInvocation {
  /** The handler threw or the runner failed: there is no result. */
  crashed: boolean;
  /** `batchItemFailures[].itemIdentifier` from the result. */
  failedIds: Set<string>;
  /** stdout and stderr, for display. */
  output: string;
}

/** Parses what invoke.ts prints after "--- result ---". */
export const parseInvocationOutput = (stdout: string): ChildInvocation => {
  const failedIds = new Set<string>();
  const marker = stdout.split("--- result ---")[1];
  let crashed = true;
  if (marker) {
    try {
      const parsed = JSON.parse(marker) as {
        batchItemFailures?: { itemIdentifier: string }[];
      } | null;
      for (const failure of parsed?.batchItemFailures ?? []) {
        failedIds.add(failure.itemIdentifier);
      }
      crashed = false;
    } catch {
      // Treated as a crash.
    }
  }
  return { crashed, failedIds, output: "" };
};

/** Binary values (stream records) are base64 in a Lambda event. */
const jsonReplacer = (_key: string, value: unknown): unknown =>
  value instanceof Uint8Array ? Buffer.from(value).toString("base64") : value;

export const invokeInChild = (
  functionName: string,
  event: unknown
): ChildInvocation => {
  const result = spawnSync(
    process.execPath,
    [
      "--disable-warning=ExperimentalWarning",
      join(REPO_ROOT, "dev/local/invoke.ts"),
      functionName,
      "-",
    ],
    {
      env: process.env,
      cwd: REPO_ROOT,
      input: JSON.stringify(event, jsonReplacer),
      encoding: "utf8",
    }
  );
  return {
    ...parseInvocationOutput(result.stdout),
    output: `${result.stdout}${result.stderr}`,
  };
};
