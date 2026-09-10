import { describe, test, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadLockfile,
  resolvePackageEntry,
  resolveTransitiveDependencies,
} from "./lockfile.js";

let tmpDir: string | undefined;

afterEach(() => {
  if (tmpDir) {
    rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = undefined;
  }
});

function writeLockfile(contents: unknown): string {
  tmpDir = mkdtempSync(join(tmpdir(), "lockfile-test-"));
  const lockfilePath = join(tmpDir, "package-lock.json");
  writeFileSync(lockfilePath, JSON.stringify(contents));
  return lockfilePath;
}

describe("loadLockfile", () => {
  test("parses a lockfileVersion 3 file", () => {
    const lockfilePath = writeLockfile({ lockfileVersion: 3, packages: {} });

    expect(loadLockfile(lockfilePath)).toEqual({
      lockfileVersion: 3,
      packages: {},
    });
  });

  test("throws for lockfileVersion below 3", () => {
    const lockfilePath = writeLockfile({ lockfileVersion: 2, packages: {} });

    expect(() => loadLockfile(lockfilePath)).toThrow(
      /Unsupported package-lock.json lockfileVersion: 2/
    );
  });
});

describe("resolvePackageEntry", () => {
  test("returns the entry for a package present at the root", () => {
    const lockfile = {
      packages: {
        "node_modules/tslib": { version: "2.8.1" },
      },
    };

    expect(resolvePackageEntry(lockfile, "tslib")).toEqual({
      version: "2.8.1",
    });
  });

  test("throws when the package is not present in the lockfile", () => {
    const lockfile = { packages: {} };

    expect(() => resolvePackageEntry(lockfile, "missing-package")).toThrow(
      /Could not resolve "missing-package" in package-lock.json/
    );
  });
});

describe("resolveTransitiveDependencies", () => {
  test("resolves a single root package with no dependencies", () => {
    const lockfile = {
      packages: {
        "node_modules/tslib": { version: "2.8.1", integrity: "sha512-abc" },
      },
    };

    expect(resolveTransitiveDependencies(lockfile, ["tslib"])).toEqual([
      { name: "tslib", version: "2.8.1", integrity: "sha512-abc" },
    ]);
  });

  test("resolves the full transitive tree of a root package", () => {
    const lockfile = {
      packages: {
        "node_modules/@aws-sdk/client-dynamodb": {
          version: "3.1106.0",
          integrity: "sha512-root",
          dependencies: { "@aws-sdk/core": "^3.977.6", tslib: "^2.6.2" },
        },
        "node_modules/@aws-sdk/core": {
          version: "3.977.8",
          integrity: "sha512-core",
          dependencies: { tslib: "^2.6.2" },
        },
        "node_modules/tslib": { version: "2.8.1", integrity: "sha512-tslib" },
      },
    };

    const result = resolveTransitiveDependencies(lockfile, [
      "@aws-sdk/client-dynamodb",
    ]);

    expect(result).toEqual([
      {
        name: "@aws-sdk/client-dynamodb",
        version: "3.1106.0",
        integrity: "sha512-root",
      },
      { name: "@aws-sdk/core", version: "3.977.8", integrity: "sha512-core" },
      { name: "tslib", version: "2.8.1", integrity: "sha512-tslib" },
    ]);
  });

  test("deduplicates a package reachable via multiple paths", () => {
    const lockfile = {
      packages: {
        "node_modules/a": {
          version: "1.0.0",
          dependencies: { shared: "^1.0.0" },
        },
        "node_modules/b": {
          version: "1.0.0",
          dependencies: { shared: "^1.0.0" },
        },
        "node_modules/shared": { version: "1.0.0", integrity: "sha512-x" },
      },
    };

    const result = resolveTransitiveDependencies(lockfile, ["a", "b"]);

    expect(result.filter((dep) => dep.name === "shared")).toHaveLength(1);
  });

  test("does not loop forever on a dependency cycle", () => {
    const lockfile = {
      packages: {
        "node_modules/a": { version: "1.0.0", dependencies: { b: "^1.0.0" } },
        "node_modules/b": { version: "1.0.0", dependencies: { a: "^1.0.0" } },
      },
    };

    const result = resolveTransitiveDependencies(lockfile, ["a"]);

    expect(result.map((dep) => dep.name).sort()).toEqual(["a", "b"]);
  });

  test("falls back to null integrity when the lockfile entry has none", () => {
    const lockfile = {
      packages: {
        "node_modules/tslib": { version: "2.8.1" },
      },
    };

    expect(resolveTransitiveDependencies(lockfile, ["tslib"])).toEqual([
      { name: "tslib", version: "2.8.1", integrity: null },
    ]);
  });

  test("returns results sorted by package name", () => {
    const lockfile = {
      packages: {
        "node_modules/zeta": { version: "1.0.0" },
        "node_modules/alpha": { version: "1.0.0" },
      },
    };

    const result = resolveTransitiveDependencies(lockfile, ["zeta", "alpha"]);

    expect(result.map((dep) => dep.name)).toEqual(["alpha", "zeta"]);
  });

  test("throws when a root package cannot be resolved", () => {
    const lockfile = { packages: {} };

    expect(() =>
      resolveTransitiveDependencies(lockfile, ["missing-package"])
    ).toThrow(/Could not resolve "missing-package"/);
  });
});
