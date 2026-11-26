// Delivers new DynamoDB stream records to the Lambdas triggered by them, like
// the event source mappings in template.yaml.
//
//   npm run local:run-streams                       all stream-triggered functions
//   npm run local:run-streams -- <function>         just that one
//   npm run local:run-streams -- --replay           ignore what was already delivered
//
// See docs/local-development.md.

import { assertEmulatorEnvironment } from "./runtime.ts";
import { runStreams } from "./stream.ts";

const main = async (): Promise<number> => {
  assertEmulatorEnvironment();
  const args = process.argv.slice(2);
  const ok = await runStreams({
    functionName: args.find((arg) => !arg.startsWith("--")),
    replay: args.includes("--replay"),
  });
  return ok ? 0 : 1;
};

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(
      error instanceof Error ? (error.stack ?? error.message) : error
    );
    process.exit(1);
  }
);
