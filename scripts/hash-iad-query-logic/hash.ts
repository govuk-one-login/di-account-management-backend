import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { relative } from "node:path";

interface HashDependency {
  name: string;
  version: string;
  integrity: string | null;
}

export interface HashInput {
  localFiles: Iterable<string>;
  dependencies: HashDependency[];
}

export interface HashOptions {
  repoRoot: string;
}

/**
 * Computes a deterministic SHA-256 hash from a set of local files (by
 * content + path relative to repoRoot) and resolved npm dependencies
 * (by name + version + integrity). Sorted before hashing so the result
 * doesn't depend on input order.
 *
 * @example
 * computeHash(
 *   {
 *     localFiles: ["/repo/src/common/model.ts", "/repo/src/common/query-inactive-accounts.ts"],
 *     dependencies: [{ name: "bowser", version: "2.14.1", integrity: null }],
 *   },
 *   { repoRoot: "/repo" }
 * )
 * // => "8082d0d5cf929648ee57a534dc55de1cec7cb66b031ed21c528faa9ae36887a3" // pragma: allowlist secret
 */
export function computeHash(
  { localFiles, dependencies }: HashInput,
  { repoRoot }: HashOptions
): string {
  const hash = createHash("sha256");

  for (const file of [...localFiles].sort((a, b) => a.localeCompare(b))) {
    hash.update(relative(repoRoot, file));
    hash.update(readFileSync(file));
  }

  for (const dep of [...dependencies].sort((a, b) => a.name.localeCompare(b.name))) {
    hash.update(`${dep.name}@${dep.version}:${dep.integrity}`);
  }

  return hash.digest("hex");
}
