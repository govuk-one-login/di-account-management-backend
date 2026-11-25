// Pure-ish helpers used by invoke.ts, bootstrap.ts and verify.ts.

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { build } from "esbuild";
import type { Context } from "aws-lambda";
import {
  ACCOUNT_ID,
  BUILD_DIR,
  EVENTS_DIR,
  REGION,
  RESOURCES_FILE,
  SRC_DIR,
  STACK_NAME,
  type LocalResources,
} from "./config.ts";
import type { EnvValue, LocalFunction } from "./functions.ts";

/**
 * Refuses to continue unless the AWS SDK is pointed at an emulator on this
 * machine, so local tooling can never talk to real AWS by accident (the SDK
 * would otherwise fall back to whatever credentials the shell has).
 */
export const assertEmulatorEnvironment = (
  env: NodeJS.ProcessEnv = process.env
): void => {
  const endpoint = env.AWS_ENDPOINT_URL;
  if (!endpoint) {
    throw new Error(
      "AWS_ENDPOINT_URL is not set. Run this through the npm scripts (they load the emulator environment), after `npm run local:up`."
    );
  }
  const { hostname } = new URL(endpoint);
  if (hostname !== "127.0.0.1" && hostname !== "localhost") {
    throw new Error(
      `AWS_ENDPOINT_URL is ${endpoint}. Refusing to run: it must point at the local emulator.`
    );
  }
  if (!env.AWS_SHARED_CREDENTIALS_FILE?.includes("/.aws/emulator/")) {
    throw new Error(
      "AWS_SHARED_CREDENTIALS_FILE does not point at the emulator's credentials, so your own AWS credentials could be picked up. Run this through the npm scripts."
    );
  }
  if (env.AWS_ACCESS_KEY_ID || env.AWS_SESSION_TOKEN || env.AWS_PROFILE) {
    throw new Error(
      "Real AWS credentials are set in the environment (AWS_ACCESS_KEY_ID / AWS_SESSION_TOKEN / AWS_PROFILE). Refusing to run."
    );
  }
};

export const loadResources = (path = RESOURCES_FILE): LocalResources => {
  if (!existsSync(path)) {
    throw new Error(
      `${path} not found. Run \`npm run local:bootstrap\` first (the emulator forgets everything when it restarts).`
    );
  }
  return JSON.parse(readFileSync(path, "utf8")) as LocalResources;
};

const resolveValue = (
  name: string,
  value: EnvValue,
  getResources: () => LocalResources
): string => {
  if (typeof value === "string") return value;
  const resources = getResources();
  if ("queue" in value) {
    const url = resources.queueUrls[value.queue];
    if (!url) {
      throw new Error(
        `No queue "${value.queue}" for ${name}. Re-run \`npm run local:bootstrap\`.`
      );
    }
    return url;
  }
  return resources.keyArns[value.key];
};

/**
 * Turns the manifest env of a function into plain strings. The resources file
 * is only read when the function actually references a queue or key.
 */
export const resolveEnv = (
  fn: LocalFunction,
  getResources: () => LocalResources = loadResources
): Record<string, string> => {
  let resources: LocalResources | undefined;
  const lazy = () => (resources ??= getResources());
  return Object.fromEntries(
    Object.entries(fn.env).map(([name, value]) => [
      name,
      resolveValue(name, value, lazy),
    ])
  );
};

/**
 * The variables the Lambda runtime provides. Values already in the
 * environment win, except the region which always matches the emulator.
 */
export const lambdaRuntimeEnv = (
  fn: LocalFunction
): Record<string, string> => ({
  AWS_REGION: REGION,
  AWS_DEFAULT_REGION: REGION,
  AWS_LAMBDA_FUNCTION_NAME: functionName(fn),
  AWS_LAMBDA_FUNCTION_VERSION: "$LATEST",
  AWS_LAMBDA_FUNCTION_MEMORY_SIZE: "128",
  AWS_LAMBDA_LOG_GROUP_NAME: `/aws/lambda/${functionName(fn)}`,
  AWS_LAMBDA_LOG_STREAM_NAME: "local",
  AWS_EXECUTION_ENV: "AWS_Lambda_nodejs24.x",
});

export const FUNCTION_NAME_PREFIX = `local-${STACK_NAME}-`;

export const functionName = (fn: LocalFunction): string =>
  `${FUNCTION_NAME_PREFIX}${fn.name}`;

export const buildContext = (
  fn: LocalFunction,
  timeoutMs = 30_000
): Context => {
  const deadline = Date.now() + timeoutMs;
  return {
    callbackWaitsForEmptyEventLoop: true,
    functionName: functionName(fn),
    functionVersion: "$LATEST",
    invokedFunctionArn: `arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${functionName(fn)}`,
    memoryLimitInMB: "128",
    awsRequestId: randomUUID(),
    logGroupName: `/aws/lambda/${functionName(fn)}`,
    logStreamName: "local",
    getRemainingTimeInMillis: () => Math.max(0, deadline - Date.now()),
    done: () => undefined,
    fail: () => undefined,
    succeed: () => undefined,
  };
};

type JsonObject = Record<string, unknown>;

const SQS_RECORD_DEFAULTS = (index: number): JsonObject => ({
  messageId: `local-message-${index}`,
  receiptHandle: `local-receipt-${index}`,
  attributes: {
    ApproximateReceiveCount: "1",
    SentTimestamp: String(Date.now()),
    SenderId: "local",
    ApproximateFirstReceiveTimestamp: String(Date.now()),
  },
  messageAttributes: {},
  md5OfBody: "",
  eventSource: "aws:sqs",
  eventSourceARN: `arn:aws:sqs:${REGION}:${ACCOUNT_ID}:local-queue`,
  awsRegion: REGION,
});

/**
 * Makes hand-written event files shorter: for SQS records, `body` may be a
 * JSON object (it is stringified, as SQS would deliver it) and the fields the
 * handlers never care about (receiptHandle, attributes...) are filled in.
 * Anything that isn't an SQS event is passed through untouched.
 */
export const normaliseEvent = (event: unknown): unknown => {
  if (typeof event !== "object" || event === null) return event;
  const records = (event as JsonObject).Records;
  if (!Array.isArray(records)) return event;
  const isSqs = records.every(
    (record) =>
      typeof record === "object" &&
      record !== null &&
      "body" in record &&
      !("dynamodb" in record)
  );
  if (!isSqs) return event;

  return {
    ...(event as JsonObject),
    Records: records.map((record: JsonObject, index) => ({
      ...SQS_RECORD_DEFAULTS(index),
      ...record,
      body:
        typeof record.body === "string"
          ? record.body
          : JSON.stringify(record.body),
    })),
  };
};

/**
 * `source` is a path to a JSON file or "-" for stdin. With no source, falls
 * back to dev/local/events/<function>.json.
 */
export const loadEvent = (
  fn: LocalFunction,
  source: string | undefined,
  readStdin: () => string = () => readFileSync(0, "utf8"),
  eventsDir = EVENTS_DIR
): unknown => {
  let text: string;
  if (source === "-") {
    text = readStdin();
  } else {
    const path = source ? resolve(source) : join(eventsDir, `${fn.name}.json`);
    if (!existsSync(path)) {
      throw new Error(
        source
          ? `Event file not found: ${path}`
          : `No event given and no sample event at ${path}. Pass an event file, or "-" to read JSON from stdin.`
      );
    }
    text = readFileSync(path, "utf8");
  }
  return normaliseEvent(JSON.parse(text));
};

export interface ParsedArgs {
  list: boolean;
  noLogs: boolean;
  functionName?: string;
  eventSource?: string;
}

export const parseArgs = (argv: string[]): ParsedArgs => {
  const positional = argv.filter((arg) => !arg.startsWith("--"));
  return {
    list: argv.includes("--list"),
    noLogs: argv.includes("--no-logs"),
    functionName: positional[0],
    eventSource: positional[1],
  };
};

export type Handler = (event: unknown, context: Context) => Promise<unknown>;

/**
 * Bundles src/<handler file>.ts with esbuild the way template.yaml does (no
 * `sam build` needed) and imports the result. Environment variables must be set BEFORE this is
 * called, because some modules read them at import time.
 */
export const loadHandler = async (fn: LocalFunction): Promise<Handler> => {
  const split = fn.handler.lastIndexOf(".");
  const file = fn.handler.slice(0, split);
  const exportName = fn.handler.slice(split + 1);
  const outfile = join(BUILD_DIR, `${fn.name}.mjs`);

  await build({
    entryPoints: [join(SRC_DIR, `${file}.ts`)],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node24",
    // Same as the template's esbuild Metadata, so CommonJS dependencies behave
    // as they do when deployed (minification is left off for readable stacks).
    banner: {
      js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
    },
    sourcemap: "inline",
    logLevel: "silent",
  });

  const module = (await import(pathToFileURL(outfile).href)) as Record<
    string,
    unknown
  >;
  const handler = module[exportName];
  if (typeof handler !== "function") {
    throw new Error(`${fn.handler} did not export a function "${exportName}".`);
  }
  return handler as Handler;
};
