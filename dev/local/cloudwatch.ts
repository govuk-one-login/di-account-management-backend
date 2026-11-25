// Sends what a handler logs to the emulator's CloudWatch Logs, the way the
// Lambda service does, so `npm run local:logs` / `aws logs tail` work.
//
// It uses the AWS CLI (no extra dependency). Publishing is best-effort: if the
// CLI is missing or the emulator build does not support CloudWatch Logs, the
// invocation is not affected, it only prints a warning.

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { LocalFunction } from "./functions.ts";
import { functionName } from "./runtime.ts";

export interface LogEvent {
  /** Milliseconds since the epoch. */
  timestamp: number;
  message: string;
}

export interface AwsCliResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

export type AwsCli = (args: string[]) => AwsCliResult;

/** Runs the AWS CLI with the current environment (already the emulator's). */
export const runAwsCli: AwsCli = (args) => {
  const result = spawnSync("aws", args, { encoding: "utf8", env: process.env });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.error ? result.error.message : (result.stderr ?? ""),
  };
};

export const logGroupName = (fn: LocalFunction): string =>
  `/aws/lambda/${functionName(fn)}`;

/** Same layout as Lambda: 2024/11/05/[$LATEST]<32 hex characters> */
export const logStreamName = (now: Date, id = randomUUID()): string => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getUTCFullYear()}/${pad(now.getUTCMonth() + 1)}/${pad(now.getUTCDate())}/[$LATEST]${id.replaceAll("-", "")}`;
};

export interface OutputCapture {
  /** Stops capturing and returns the text written since it started. */
  stop: () => string;
}

/**
 * Copies everything written to stdout/stderr (the handler's logs) while still
 * letting it through to the terminal.
 */
export const captureOutput = (): OutputCapture => {
  const chunks: string[] = [];
  const originalStdout = process.stdout.write;
  const originalStderr = process.stderr.write;

  const wrap = (
    stream: NodeJS.WriteStream,
    original: typeof process.stdout.write
  ): typeof process.stdout.write =>
    ((chunk: string | Uint8Array, ...rest: unknown[]) => {
      chunks.push(
        typeof chunk === "string" ? chunk : Buffer.from(chunk).toString()
      );
      return (original as (...args: unknown[]) => boolean).call(
        stream,
        chunk,
        ...rest
      );
    }) as typeof process.stdout.write;

  process.stdout.write = wrap(process.stdout, originalStdout);
  process.stderr.write = wrap(process.stderr, originalStderr);
  return {
    stop: () => {
      process.stdout.write = originalStdout;
      process.stderr.write = originalStderr;
      return chunks.join("");
    },
  };
};

const timestampOf = (line: string): number | undefined => {
  if (!line.startsWith("{")) return undefined;
  try {
    const { timestamp } = JSON.parse(line) as { timestamp?: unknown };
    const parsed = typeof timestamp === "string" ? Date.parse(timestamp) : NaN;
    return Number.isNaN(parsed) ? undefined : parsed;
  } catch {
    return undefined;
  }
};

export interface InvocationSummary {
  requestId: string;
  startedAt: number;
  endedAt: number;
  memorySizeMb: number;
  maxMemoryUsedMb: number;
  /** What the handler wrote, in order. */
  output: string;
  error?: Error;
}

/**
 * START / handler output / END / REPORT, like a Lambda log stream. Lines that
 * are Powertools JSON keep their own timestamp. Lines are returned in
 * non-decreasing time order, which PutLogEvents requires.
 */
export const buildLogEvents = (summary: InvocationSummary): LogEvent[] => {
  const { requestId, startedAt, endedAt } = summary;
  const events: LogEvent[] = [
    {
      timestamp: startedAt,
      message: `START RequestId: ${requestId} Version: $LATEST`,
    },
  ];

  let previous = startedAt;
  for (const line of summary.output.split("\n")) {
    if (line.trim() === "") continue;
    const timestamp = Math.max(timestampOf(line) ?? previous, previous);
    events.push({ timestamp, message: line });
    previous = timestamp;
  }

  if (summary.error) {
    events.push({
      timestamp: Math.max(endedAt, previous),
      message: JSON.stringify({
        errorType: summary.error.name,
        errorMessage: summary.error.message,
        stackTrace: (summary.error.stack ?? "").split("\n").slice(1),
      }),
    });
    previous = Math.max(endedAt, previous);
  }

  const end = Math.max(endedAt, previous);
  const duration = Math.max(0, endedAt - startedAt);
  events.push(
    { timestamp: end, message: `END RequestId: ${requestId}` },
    {
      timestamp: end,
      message: `REPORT RequestId: ${requestId}\tDuration: ${duration.toFixed(2)} ms\tBilled Duration: ${Math.ceil(duration)} ms\tMemory Size: ${summary.memorySizeMb} MB\tMax Memory Used: ${summary.maxMemoryUsedMb} MB`,
    }
  );
  return events;
};

export const chunk = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

export interface PublishResult {
  published: boolean;
  /** Why not, when published is false. */
  reason?: string;
}

const failure = (step: string, result: AwsCliResult): PublishResult => ({
  published: false,
  reason: `${step}: ${result.stderr.trim().split("\n").pop() || `exit ${result.status}`}`,
});

/** Creates the log group and a new stream, then writes the events to it. */
export const publishLogs = (
  fn: LocalFunction,
  events: LogEvent[],
  aws: AwsCli = runAwsCli,
  now: Date = new Date()
): PublishResult => {
  const group = logGroupName(fn);
  const stream = logStreamName(now);

  const createGroup = aws([
    "logs",
    "create-log-group",
    "--log-group-name",
    group,
  ]);
  if (
    createGroup.status !== 0 &&
    !createGroup.stderr.includes("ResourceAlreadyExistsException")
  ) {
    return failure("create-log-group", createGroup);
  }

  const createStream = aws([
    "logs",
    "create-log-stream",
    "--log-group-name",
    group,
    "--log-stream-name",
    stream,
  ]);
  if (createStream.status !== 0)
    return failure("create-log-stream", createStream);

  const dir = mkdtempSync(join(tmpdir(), "local-logs-"));
  try {
    // A batch may hold at most 10,000 events / 1 MB, stay well inside both.
    for (const [index, batch] of chunk(events, 1000).entries()) {
      const file = join(dir, `batch-${index}.json`);
      writeFileSync(file, JSON.stringify(batch));
      const put = aws([
        "logs",
        "put-log-events",
        "--log-group-name",
        group,
        "--log-stream-name",
        stream,
        "--log-events",
        `file://${file}`,
      ]);
      if (put.status !== 0) return failure("put-log-events", put);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return { published: true };
};
