import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildLogEvents,
  captureOutput,
  chunk,
  logGroupName,
  logStreamName,
  publishLogs,
  type AwsCli,
  type AwsCliResult,
} from "../cloudwatch.ts";
import { findFunction } from "../functions.ts";

const fn = findFunction("write-activity-log")!;
const ok: AwsCliResult = { status: 0, stdout: "", stderr: "" };

describe("names", () => {
  it("uses the Lambda log group and stream layout", () => {
    expect(logGroupName(fn)).toBe(
      "/aws/lambda/local-home-backend-write-activity-log"
    );
    expect(logStreamName(new Date("2024-11-05T10:00:00Z"), "aaaa-bbbb")).toBe(
      "2024/11/05/[$LATEST]aaaabbbb"
    );
  });
});

describe("buildLogEvents", () => {
  const base = {
    requestId: "req-1",
    startedAt: 1_000,
    endedAt: 1_250,
    memorySizeMb: 128,
    maxMemoryUsedMb: 90,
  };

  it("wraps the output in START, END and REPORT lines", () => {
    const events = buildLogEvents({ ...base, output: "plain line\n" });
    expect(events.map((e) => e.message)).toEqual([
      "START RequestId: req-1 Version: $LATEST",
      "plain line",
      "END RequestId: req-1",
      "REPORT RequestId: req-1\tDuration: 250.00 ms\tBilled Duration: 250 ms\tMemory Size: 128 MB\tMax Memory Used: 90 MB",
    ]);
  });

  it("keeps the timestamp of Powertools JSON lines", () => {
    const line = JSON.stringify({
      level: "INFO",
      message: "hi",
      timestamp: new Date(1_100).toISOString(),
    });
    const events = buildLogEvents({ ...base, output: `${line}\n` });
    expect(events[1]).toEqual({ timestamp: 1_100, message: line });
  });

  it("never goes back in time and skips blank lines", () => {
    const early = JSON.stringify({ timestamp: new Date(500).toISOString() });
    const events = buildLogEvents({ ...base, output: `\n${early}\n\n` });
    const stamps = events.map((e) => e.timestamp);
    expect(stamps).toEqual([...stamps].sort((a, b) => a - b));
    expect(events).toHaveLength(4);
  });

  it("records an error thrown by the handler", () => {
    const events = buildLogEvents({
      ...base,
      output: "",
      error: new TypeError("boom"),
    });
    const error = JSON.parse(events[1].message) as Record<string, unknown>;
    expect(error).toMatchObject({
      errorType: "TypeError",
      errorMessage: "boom",
    });
  });
});

describe("chunk", () => {
  it("splits into batches", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
  });
});

describe("publishLogs", () => {
  const events = [{ timestamp: 1, message: "m" }];

  it("creates the group and stream, then puts the events", () => {
    const calls: string[][] = [];
    let sent: unknown;
    const aws: AwsCli = (args) => {
      calls.push(args);
      if (args[1] === "put-log-events") {
        sent = JSON.parse(
          readFileSync(args[args.length - 1].replace("file://", ""), "utf8")
        );
      }
      return ok;
    };
    expect(publishLogs(fn, events, aws)).toEqual({ published: true });
    expect(calls.map((c) => c[1])).toEqual([
      "create-log-group",
      "create-log-stream",
      "put-log-events",
    ]);
    expect(calls[0]).toContain(
      "/aws/lambda/local-home-backend-write-activity-log"
    );
    expect(sent).toEqual(events);
  });

  it("accepts a log group that already exists", () => {
    const aws: AwsCli = (args) =>
      args[1] === "create-log-group"
        ? { status: 254, stdout: "", stderr: "ResourceAlreadyExistsException" }
        : ok;
    expect(publishLogs(fn, events, aws).published).toBe(true);
  });

  it("reports why it could not publish instead of throwing", () => {
    const aws: AwsCli = () => ({
      status: null,
      stdout: "",
      stderr: "spawnSync aws ENOENT",
    });
    expect(publishLogs(fn, events, aws)).toEqual({
      published: false,
      reason: "create-log-group: spawnSync aws ENOENT",
    });

    const unsupported: AwsCli = (args) =>
      args[1] === "put-log-events"
        ? { status: 254, stdout: "", stderr: "line1\nNotImplemented" }
        : ok;
    expect(publishLogs(fn, events, unsupported).reason).toBe(
      "put-log-events: NotImplemented"
    );
  });
});

describe("captureOutput", () => {
  it("returns what was written and restores the streams", () => {
    const before = process.stdout.write;
    const capture = captureOutput();
    process.stdout.write("captured line\n");
    const text = capture.stop();
    expect(text).toContain("captured line");
    expect(process.stdout.write).toBe(before);
  });
});
