// Runs one Lambda handler from src/ against the local AWS Emulator.
//
//   npm run local:invoke -- <function> [event.json | -]
//   npm run local:list
//
// With no event argument it uses dev/local/events/<function>.json. "-" reads
// the event from stdin. See docs/local-development.md.

import { FUNCTIONS, findFunction, type LocalFunction } from "./functions.ts";
import {
  assertEmulatorEnvironment,
  buildContext,
  lambdaRuntimeEnv,
  loadEvent,
  loadHandler,
  parseArgs,
  resolveEnv,
} from "./runtime.ts";

const listFunctions = (): void => {
  const width = Math.max(...FUNCTIONS.map((fn) => fn.name.length));
  for (const fn of FUNCTIONS) {
    const note = fn.notes ? `  ${fn.notes}` : "";
    console.log(
      `${fn.name.padEnd(width)}  ${fn.status.padEnd(10)}  ${fn.trigger.padEnd(15)}${note}`
    );
  }
};

const failedBatchItems = (result: unknown): unknown[] => {
  if (typeof result !== "object" || result === null) return [];
  const failures = (result as { batchItemFailures?: unknown })
    .batchItemFailures;
  return Array.isArray(failures) ? failures : [];
};

const run = async (
  fn: LocalFunction,
  eventSource?: string
): Promise<number> => {
  assertEmulatorEnvironment();

  const event = loadEvent(fn, eventSource);
  // Set everything before importing the handler: some modules read their
  // configuration when they are first loaded.
  Object.assign(process.env, resolveEnv(fn), lambdaRuntimeEnv(fn));

  if (fn.status === "unverified") {
    console.error(
      `[local] ${fn.name} is not verified against the emulator${fn.notes ? `: ${fn.notes}` : ""}`
    );
  }

  const handler = await loadHandler(fn);
  const result = await handler(event, buildContext(fn));

  console.log("--- result ---");
  console.log(JSON.stringify(result ?? null, null, 2));

  const failures = failedBatchItems(result);
  if (failures.length > 0) {
    console.error(`[local] ${failures.length} batch item failure(s)`);
    return 1;
  }
  return 0;
};

const main = async (): Promise<number> => {
  const args = parseArgs(process.argv.slice(2));
  if (args.list) {
    listFunctions();
    return 0;
  }
  if (!args.functionName) {
    console.error("Usage: npm run local:invoke -- <function> [event.json | -]");
    console.error("Run `npm run local:list` to see the functions.");
    return 2;
  }
  const fn = findFunction(args.functionName);
  if (!fn) {
    console.error(`Unknown function "${args.functionName}".`);
    console.error("Run `npm run local:list` to see the functions.");
    return 2;
  }
  return run(fn, args.eventSource);
};

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? (error.stack ?? error.message) : error
    );
    // Exit explicitly: open SDK connections would otherwise keep us alive.
    process.exit(1);
  });
