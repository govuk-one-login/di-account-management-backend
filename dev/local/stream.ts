// Does what the DynamoDB stream event source mappings in template.yaml do in
// AWS: reads the new records from a table's stream, keeps the ones that match
// the mapping's filter, and invokes the Lambda with them in batches.
//
// Nothing runs in the background: this is called on demand (`npm run
// local:run-streams`). Each function remembers how far it has read in
// STREAM_CHECKPOINTS_FILE, so a record is delivered once. The first run for a
// function reads from the start of the stream (AWS starts at LATEST).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { DynamoDBClient, DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import {
  DescribeStreamCommand,
  DynamoDBStreamsClient,
  GetRecordsCommand,
  GetShardIteratorCommand,
  type _Record as StreamRecord,
} from "@aws-sdk/client-dynamodb-streams";
import { STREAM_CHECKPOINTS_FILE } from "./config.ts";
import { FUNCTIONS } from "./functions.ts";
import { invokeInChild, type ChildInvocation } from "./spawn.ts";
import { loadTemplate, type StreamTrigger } from "./template.ts";

type Json = Record<string, unknown>;

/** A stream record as Lambda delivers it. */
export interface LambdaStreamRecord extends Json {
  eventSourceARN: string;
  dynamodb: { SequenceNumber: string } & Json;
}

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The subset of Lambda event filtering the template uses: nested objects, and
 * arrays of literal values (a value matches if it equals any of them).
 * Anything else (prefix, exists...) is rejected rather than guessed at.
 */
export const matchesPattern = (pattern: unknown, value: unknown): boolean => {
  if (Array.isArray(pattern)) {
    if (pattern.some((item) => typeof item === "object" && item !== null)) {
      throw new Error(
        `Unsupported filter operator in ${JSON.stringify(pattern)}`
      );
    }
    return pattern.includes(value);
  }
  if (isObject(pattern)) {
    if (!isObject(value)) return false;
    return Object.entries(pattern).every(([key, expected]) =>
      matchesPattern(expected, value[key])
    );
  }
  throw new Error(`Unsupported filter ${JSON.stringify(pattern)}`);
};

/** No filter means every record is delivered. */
export const matchesFilters = (
  filterPatterns: string[],
  record: LambdaStreamRecord
): boolean =>
  filterPatterns.length === 0 ||
  filterPatterns.some((pattern) =>
    matchesPattern(JSON.parse(pattern) as unknown, record)
  );

/** Same shape as the Lambda event: timestamps are epoch seconds. */
export const toLambdaRecord = (
  record: StreamRecord,
  streamArn: string
): LambdaStreamRecord => {
  const { ApproximateCreationDateTime, ...rest } = record.dynamodb ?? {};
  return {
    ...record,
    eventSourceARN: streamArn,
    dynamodb: {
      ...(ApproximateCreationDateTime && {
        ApproximateCreationDateTime: Math.floor(
          ApproximateCreationDateTime.getTime() / 1000
        ),
      }),
      ...rest,
      SequenceNumber: record.dynamodb?.SequenceNumber ?? "",
    },
  } as LambdaStreamRecord;
};

const sequence = (record: LambdaStreamRecord): bigint =>
  BigInt(record.dynamodb.SequenceNumber);

export interface StreamRun {
  /** Number of records read after the checkpoint. */
  read: number;
  /** Records that matched the filter. */
  matched: number;
  invocations: number;
  /** Set when a batch failed: the rest is left for the next run. */
  failed: boolean;
  /** Sequence number of the last record that is done, if it moved. */
  checkpoint?: string;
}

/**
 * Delivers `records` (oldest first, all after the checkpoint) to one function.
 * Stops at the first failure and leaves the checkpoint just before the failed
 * record, so that record and everything after it is delivered again next time.
 */
export const deliver = (
  records: LambdaStreamRecord[],
  trigger: Pick<
    StreamTrigger,
    "batchSize" | "filterPatterns" | "reportBatchItemFailures"
  >,
  invoke: (
    batch: LambdaStreamRecord[]
  ) => Pick<ChildInvocation, "crashed" | "failedIds">
): StreamRun => {
  const matching = records.filter((record) =>
    matchesFilters(trigger.filterPatterns, record)
  );
  const run: StreamRun = {
    read: records.length,
    matched: matching.length,
    invocations: 0,
    failed: false,
  };

  // Everything before `stopAt` is done (filtered-out records count as done).
  let stopAt = records.length;
  for (let i = 0; i < matching.length; i += trigger.batchSize) {
    const batch = matching.slice(i, i + trigger.batchSize);
    const result = invoke(batch);
    run.invocations++;

    let firstFailed: LambdaStreamRecord | undefined;
    if (result.crashed) {
      firstFailed = batch[0];
    } else if (trigger.reportBatchItemFailures && result.failedIds.size > 0) {
      firstFailed =
        batch.find((record) =>
          result.failedIds.has(record.dynamodb.SequenceNumber)
        ) ?? batch[0];
    }
    if (firstFailed) {
      run.failed = true;
      stopAt = records.indexOf(firstFailed);
      break;
    }
  }

  if (stopAt > 0) {
    run.checkpoint = records[stopAt - 1].dynamodb.SequenceNumber;
  }
  return run;
};

const readCheckpoints = (
  path = STREAM_CHECKPOINTS_FILE
): Record<string, string> =>
  existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as Record<string, string>)
    : {};

const writeCheckpoints = (
  checkpoints: Record<string, string>,
  path = STREAM_CHECKPOINTS_FILE
): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(checkpoints, null, 2)}\n`);
};

/** Every record currently in the table's stream, oldest first. */
const readStream = async (tableName: string): Promise<LambdaStreamRecord[]> => {
  const { Table } = await new DynamoDBClient({}).send(
    new DescribeTableCommand({ TableName: tableName })
  );
  const streamArn = Table?.LatestStreamArn;
  if (!streamArn) {
    throw new Error(
      `${tableName} has no stream. Run \`npm run local:bootstrap\` (it enables the stream on tables that lack one).`
    );
  }

  const streams = new DynamoDBStreamsClient({});
  const shardIds: string[] = [];
  let exclusiveStartShardId: string | undefined;
  do {
    const { StreamDescription } = await streams.send(
      new DescribeStreamCommand({
        StreamArn: streamArn,
        ExclusiveStartShardId: exclusiveStartShardId,
      })
    );
    for (const shard of StreamDescription?.Shards ?? []) {
      if (shard.ShardId) shardIds.push(shard.ShardId);
    }
    exclusiveStartShardId = StreamDescription?.LastEvaluatedShardId;
  } while (exclusiveStartShardId);

  const records: LambdaStreamRecord[] = [];
  for (const shardId of shardIds) {
    const { ShardIterator } = await streams.send(
      new GetShardIteratorCommand({
        StreamArn: streamArn,
        ShardId: shardId,
        ShardIteratorType: "TRIM_HORIZON",
      })
    );
    let iterator = ShardIterator;
    while (iterator) {
      const page = await streams.send(
        new GetRecordsCommand({ ShardIterator: iterator })
      );
      // An open shard never ends, so stop at the first empty page.
      if (!page.Records?.length) break;
      records.push(
        ...page.Records.map((record) => toLambdaRecord(record, streamArn))
      );
      iterator = page.NextShardIterator;
    }
  }
  return records.sort((a, b) => (sequence(a) < sequence(b) ? -1 : 1));
};

interface RunStreamsOptions {
  /** Only this function (its local name). */
  functionName?: string;
  /** Ignore the checkpoint and deliver everything in the stream again. */
  replay?: boolean;
  log?: (line: string) => void;
}

/** Delivers new stream records to every stream-triggered function. */
export const runStreams = async ({
  functionName,
  replay = false,
  log = console.log,
}: RunStreamsOptions = {}): Promise<boolean> => {
  const template = loadTemplate();
  const checkpoints = readCheckpoints();
  const streamCache = new Map<string, Promise<LambdaStreamRecord[]>>();
  let allOk = true;
  let any = false;

  for (const templateFunction of template.functions) {
    const local = FUNCTIONS.find(
      (fn) => fn.logicalId === templateFunction.logicalId
    );
    if (!local || (functionName && local.name !== functionName)) continue;

    for (const trigger of templateFunction.streamTriggers) {
      const table = template.tables.find(
        (candidate) => candidate.logicalId === trigger.tableLogicalId
      );
      if (!table) continue;
      any = true;

      if (!streamCache.has(table.tableName)) {
        streamCache.set(table.tableName, readStream(table.tableName));
      }
      const all = await streamCache.get(table.tableName)!;
      const after = replay ? undefined : checkpoints[local.name];
      const records = after
        ? all.filter((record) => sequence(record) > BigInt(after))
        : all;

      const run = deliver(records, trigger, (batch) => {
        log(`\n[${local.name}] invoking with ${batch.length} record(s)`);
        const result = invokeInChild(local.name, { Records: batch });
        log(result.output.trim());
        return result;
      });
      if (run.checkpoint) checkpoints[local.name] = run.checkpoint;
      log(
        `[${local.name}] ${table.tableName}: ${run.read} new record(s), ${run.matched} matched the filter, ${run.invocations} invocation(s)${run.failed ? ", FAILED (will be delivered again)" : ""}`
      );
      if (run.failed) allOk = false;
    }
  }

  writeCheckpoints(checkpoints);
  if (!any) {
    log(
      functionName
        ? `${functionName} is not triggered by a DynamoDB stream. Run \`npm run local:list\`.`
        : "No stream-triggered functions found in template.yaml."
    );
  }
  return allOk;
};
