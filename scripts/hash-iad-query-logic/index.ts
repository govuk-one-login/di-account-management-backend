import { writeFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import { walkLocalImportGraph } from "./import-graph.js";
import { loadLockfile, resolveTransitiveDependencies } from "./lockfile.js";
import { computeHash } from "./hash.js";

const REPO_ROOT = process.cwd();
const ENTRY_POINT = resolve(REPO_ROOT, "src/common/query-inactive-accounts.ts");

const OUTPUT_PATH = resolve(REPO_ROOT, "src/common/iad-query-logic-hash.json");

function main(): void {
  console.log(
    "Hashing the shared IAD query logic, its local imports, and its resolved npm dependency versions..."
  );
  console.log(`Repo root: ${REPO_ROOT}`);
  console.log(`Entry point: ${ENTRY_POINT}`);

  const { localFiles, npmRoots } = walkLocalImportGraph(ENTRY_POINT);
  const relativeFiles = [...localFiles]
    .map((file) => relative(REPO_ROOT, file))
    .sort((a, b) => a.localeCompare(b));
  console.log(`Local files in hash: ${relativeFiles.join(", ")}`);

  const lockfile = loadLockfile(resolve(REPO_ROOT, "package-lock.json"));
  const dependencies = resolveTransitiveDependencies(lockfile, [...npmRoots]);
  console.log(
    `npm dependencies in hash: ${dependencies
      .map((dep) => `${dep.name}@${dep.version}`)
      .join(", ")}`
  );

  const hash = computeHash({ localFiles, dependencies }, { repoRoot: REPO_ROOT });
  console.log(`Query logic hash: ${hash}`);

  const output = {
    hash,
    algorithm: "sha256",
    generatedAt: new Date().toISOString(),
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n");
  console.log(`Wrote ${OUTPUT_PATH}`);
}

try {
  main();
} catch (error) {
  console.error("Failed to generate IAD query logic hash:", error);
  process.exitCode = 1;
}
