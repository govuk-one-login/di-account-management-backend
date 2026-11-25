// Shows the logs `local:invoke` sent to the emulator's CloudWatch Logs.
//
//   npm run local:logs                          list log groups
//   npm run local:logs -- <function>            tail that function's logs
//   npm run local:logs -- <function> --follow --since 1h
//
// Anything after the function name is passed to `aws logs tail`.

import { spawnSync } from "node:child_process";
import { findFunction } from "./functions.ts";
import { logGroupName } from "./cloudwatch.ts";
import { assertEmulatorEnvironment, FUNCTION_NAME_PREFIX } from "./runtime.ts";

const main = (): number => {
  assertEmulatorEnvironment();
  const [name, ...tailArgs] = process.argv.slice(2);

  if (!name) {
    // Every local function shares this prefix.
    const prefix = `/aws/lambda/${FUNCTION_NAME_PREFIX}`;
    const result = spawnSync(
      "aws",
      [
        "logs",
        "describe-log-groups",
        "--log-group-name-prefix",
        prefix,
        "--query",
        "logGroups[].logGroupName",
        "--output",
        "text",
      ],
      { encoding: "utf8", env: process.env }
    );
    if (result.error || result.status !== 0) {
      console.error(result.error?.message ?? result.stderr.trim());
      return 1;
    }
    const groups = result.stdout.split(/\s+/).filter(Boolean);
    console.log(
      groups.length > 0
        ? groups.join("\n")
        : "No log groups yet. Run a function with `npm run local:invoke`."
    );
    return 0;
  }

  const fn = findFunction(name);
  if (!fn) {
    console.error(`Unknown function "${name}". Run \`npm run local:list\`.`);
    return 2;
  }
  const result = spawnSync(
    "aws",
    ["logs", "tail", logGroupName(fn), ...tailArgs],
    { stdio: "inherit", env: process.env }
  );
  if (result.error) {
    console.error(result.error.message);
    return 1;
  }
  return result.status ?? 1;
};

process.exit(main());
