import { describe, expect, it } from "vitest";
import {
  deliver,
  matchesFilters,
  matchesPattern,
  toLambdaRecord,
  type LambdaStreamRecord,
} from "../stream.ts";
import { parseInvocationOutput } from "../spawn.ts";
import { loadTemplate } from "../template.ts";
import { FUNCTIONS } from "../functions.ts";

const record = (
  sequence: number,
  eventName = "INSERT",
  name = "AUTH_AUTH_CODE_ISSUED"
): LambdaStreamRecord => ({
  eventName,
  eventSourceARN: "arn:stream",
  dynamodb: {
    SequenceNumber: String(sequence),
    NewImage: { event: { M: { event_name: { S: name } } } },
  },
});

const TRACKER_PATTERN =
  '{ "eventName": ["INSERT"], "dynamodb": { "NewImage": { "event": { "M": { "event_name": { "S": ["A", "B"] } } } } } }';

describe("matchesPattern", () => {
  it("matches nested objects and any listed value", () => {
    expect(matchesFilters([TRACKER_PATTERN], record(1, "INSERT", "B"))).toBe(
      true
    );
  });

  it("rejects other values, other event types and missing keys", () => {
    expect(matchesFilters([TRACKER_PATTERN], record(1, "INSERT", "C"))).toBe(
      false
    );
    expect(matchesFilters([TRACKER_PATTERN], record(1, "MODIFY", "A"))).toBe(
      false
    );
    expect(matchesPattern({ a: ["x"] }, {})).toBe(false);
  });

  it("delivers everything when there is no filter, and any matching filter", () => {
    expect(matchesFilters([], record(1))).toBe(true);
    expect(
      matchesFilters(
        ['{ "eventName": ["REMOVE"] }', TRACKER_PATTERN],
        record(1, "INSERT", "A")
      )
    ).toBe(true);
  });

  it("refuses operators it does not implement", () => {
    expect(() => matchesPattern({ a: [{ prefix: "x" }] }, { a: "xy" })).toThrow(
      /Unsupported/
    );
  });
});

describe("toLambdaRecord", () => {
  it("adds the source ARN and turns the timestamp into epoch seconds", () => {
    const converted = toLambdaRecord(
      {
        eventName: "INSERT",
        dynamodb: {
          SequenceNumber: "7",
          ApproximateCreationDateTime: new Date("2026-01-01T00:00:00.900Z"),
        },
      },
      "arn:stream"
    );
    expect(converted.eventSourceARN).toBe("arn:stream");
    expect(converted.dynamodb).toEqual({
      SequenceNumber: "7",
      ApproximateCreationDateTime: 1767225600,
    });
  });
});

describe("deliver", () => {
  const trigger = {
    batchSize: 2,
    filterPatterns: ['{ "eventName": ["INSERT"] }'],
    reportBatchItemFailures: true,
  };
  const ok = { crashed: false, failedIds: new Set<string>() };

  it("batches the matching records and moves the checkpoint past all of them", () => {
    const batches: string[][] = [];
    const run = deliver(
      [record(1), record(2, "MODIFY"), record(3), record(4)],
      trigger,
      (batch) => {
        batches.push(batch.map((r) => r.dynamodb.SequenceNumber));
        return ok;
      }
    );
    expect(batches).toEqual([["1", "3"], ["4"]]);
    expect(run).toMatchObject({
      read: 4,
      matched: 3,
      invocations: 2,
      failed: false,
      checkpoint: "4",
    });
  });

  it("moves the checkpoint over records the filter drops", () => {
    const run = deliver([record(1, "MODIFY")], trigger, () => ok);
    expect(run).toMatchObject({ invocations: 0, checkpoint: "1" });
  });

  it("stops before the first failed item and retries from it", () => {
    let calls = 0;
    const run = deliver(
      [record(1), record(2), record(3), record(4)],
      trigger,
      () => {
        calls++;
        return { crashed: false, failedIds: new Set(["2"]) };
      }
    );
    expect(calls).toBe(1);
    expect(run).toMatchObject({ failed: true, checkpoint: "1" });
  });

  it("does not move when the first record fails or the Lambda crashes", () => {
    const run = deliver([record(1), record(2)], trigger, () => ({
      crashed: true,
      failedIds: new Set<string>(),
    }));
    expect(run.failed).toBe(true);
    expect(run.checkpoint).toBeUndefined();
  });

  it("ignores reported item failures unless the mapping asks for them", () => {
    const run = deliver(
      [record(1)],
      { ...trigger, reportBatchItemFailures: false },
      () => ({ crashed: false, failedIds: new Set(["1"]) })
    );
    expect(run).toMatchObject({ failed: false, checkpoint: "1" });
  });
});

describe("parseInvocationOutput", () => {
  it("reads batch item failures from the printed result", () => {
    const parsed = parseInvocationOutput(
      'logs\n--- result ---\n{"batchItemFailures":[{"itemIdentifier":"9"}]}\n'
    );
    expect(parsed.crashed).toBe(false);
    expect([...parsed.failedIds]).toEqual(["9"]);
  });

  it("accepts a null result and treats a missing result as a crash", () => {
    expect(parseInvocationOutput("--- result ---\nnull\n").crashed).toBe(false);
    expect(parseInvocationOutput("Error: boom").crashed).toBe(true);
  });
});

describe("stream triggers in template.yaml", () => {
  const template = loadTemplate();

  it("reads the stream triggers of the functions", () => {
    const tracker = template.functions.find(
      (fn) => fn.logicalId === "UpdateInactiveAccountTrackerFunction"
    );
    expect(tracker?.streamTriggers).toMatchObject([
      {
        tableLogicalId: "RawEventsStore",
        batchSize: 50,
        reportBatchItemFailures: true,
      },
    ]);
    expect(tracker?.streamTriggers[0].filterPatterns).toHaveLength(1);
  });

  it("only uses filters and tables the runner understands", () => {
    for (const fn of template.functions) {
      for (const trigger of fn.streamTriggers) {
        expect(
          template.tables.some((t) => t.logicalId === trigger.tableLogicalId)
        ).toBe(true);
        expect(() =>
          matchesFilters(trigger.filterPatterns, record(1))
        ).not.toThrow();
      }
    }
  });

  it("marks every stream-triggered function in the manifest", () => {
    const streamed = template.functions
      .filter((fn) => fn.streamTriggers.length > 0)
      .map((fn) => fn.logicalId);
    for (const logicalId of streamed) {
      const local = FUNCTIONS.find((fn) => fn.logicalId === logicalId);
      expect(local?.trigger, logicalId).toBe("dynamodb-stream");
    }
  });
});
