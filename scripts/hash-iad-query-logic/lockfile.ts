import { readFileSync } from "node:fs";

export interface LockfilePackageEntry {
  version: string;
  integrity?: string;
  dependencies?: Record<string, string>;
}

export interface PackagesMap {
  packages: Record<string, LockfilePackageEntry>;
}

export interface Lockfile extends PackagesMap {
  lockfileVersion: number;
}

export interface ResolvedDependency {
  name: string;
  version: string;
  integrity: string | null;
}

/**
 * Loads package-lock.json (lockfile v3 "packages" map, keyed by "node_modules/<name>").
 *
 * @example
 * // package-lock.json contains: { "lockfileVersion": 3, "packages": { "node_modules/bowser": { "version": "2.14.1" } } }
 * loadLockfile("/repo/package-lock.json")
 * // => { lockfileVersion: 3, packages: { "node_modules/bowser": { version: "2.14.1" } } }
 */
export function loadLockfile(lockfilePath: string): Lockfile {
  const lockfile = JSON.parse(readFileSync(lockfilePath, "utf8")) as Lockfile;
  if (lockfile.lockfileVersion < 3) {
    throw new Error(
      `Unsupported package-lock.json lockfileVersion: ${lockfile.lockfileVersion}. Expected >= 3.`
    );
  }
  return lockfile;
}

/**
 * Resolves a package to its lockfile entry via a flat root lookup
 * (node_modules/<name>). Assumes no shadowed/nested installs for the
 * packages reachable from this script's entry point - true today
 * (verified for the AWS SDK tree), but a future nested install would
 * silently resolve to the hoisted version. Acceptable for a build hash.
 *
 * @example
 * resolvePackageEntry(
 *   { packages: { "node_modules/bowser": { version: "2.14.1", integrity: "sha512-..." } } },
 *   "bowser"
 * )
 * // => { version: "2.14.1", integrity: "sha512-..." }
 */
export function resolvePackageEntry(
  lockfile: PackagesMap,
  name: string
): LockfilePackageEntry {
  const key = `node_modules/${name}`;
  const entry = lockfile.packages[key];
  if (!entry) {
    console.error(`Lockfile key "${key}" not found in package-lock.json`);
    throw new Error(`Could not resolve "${name}" in package-lock.json`);
  }
  return entry;
}

/**
 * Recursively resolves the dependency tree for a set of root package names via package-lock.json.
 *
 * @example
 * resolveTransitiveDependencies(
 *   {
 *     packages: {
 *       "node_modules/@aws-sdk/client-dynamodb": { version: "3.1106.0", dependencies: { "@aws-sdk/core": "^3.977.6" } },
 *       "node_modules/@aws-sdk/core": { version: "3.977.8", integrity: "sha512-core", dependencies: { bowser: "^2.11.0" } },
 *       "node_modules/bowser": { version: "2.14.1" },
 *     },
 *   },
 *   ["@aws-sdk/client-dynamodb"]
 * )
 * // => [
 * //   { name: "@aws-sdk/client-dynamodb", version: "3.1106.0", integrity: null },
 * //   { name: "@aws-sdk/core", version: "3.977.8", integrity: "sha512-core" },
 * //   { name: "bowser", version: "2.14.1", integrity: null },
 * // ]
 */
export function resolveTransitiveDependencies(
  lockfile: PackagesMap,
  rootNames: string[]
): ResolvedDependency[] {
  const resolved = new Map<string, ResolvedDependency>();
  const stack = [...rootNames];

  while (stack.length > 0) {
    const name = stack.pop() as string;
    if (resolved.has(name)) {
      continue;
    }
    const entry = resolvePackageEntry(lockfile, name);
    resolved.set(name, {
      name,
      version: entry.version,
      integrity: entry.integrity ?? null,
    });

    stack.push(...Object.keys(entry.dependencies ?? {}));
  }

  return [...resolved.values()].sort((a, b) => a.name.localeCompare(b.name));
}
