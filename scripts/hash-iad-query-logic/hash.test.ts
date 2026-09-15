import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { computeHash } from "./hash.js";

let repoRoot: string;

beforeEach(() => {
  repoRoot = mkdtempSync(join(tmpdir(), "hash-test-"));
});

afterEach(() => {
  rmSync(repoRoot, { recursive: true, force: true });
});

function writeFile(relativePath: string, contents: string): string {
  const filePath = join(repoRoot, relativePath);
  writeFileSync(filePath, contents);
  return filePath;
}

describe("computeHash", () => {
  test("produces a stable hash for identical inputs", () => {
    const file = writeFile("a.ts", "content");
    const input = {
      localFiles: [file],
      dependencies: [{ name: "tslib", version: "2.8.1", integrity: "sha512-x" }],
    };

    expect(computeHash(input, { repoRoot })).toBe(
      computeHash(input, { repoRoot })
    );
  });

  test("changes when a local file's content changes", () => {
    const file1 = writeFile("a.ts", "content");
    const input1 = { localFiles: [file1], dependencies: [] };
    const hash1 = computeHash(input1, { repoRoot });

    writeFile("a.ts", "different content");
    const input2 = { localFiles: [file1], dependencies: [] };
    const hash2 = computeHash(input2, { repoRoot });

    expect(hash1).not.toBe(hash2);
  });

  test("changes when a dependency's version changes", () => {
    const inputV1 = {
      localFiles: [],
      dependencies: [{ name: "tslib", version: "2.8.1", integrity: "sha512-x" }],
    };
    const inputV2 = {
      localFiles: [],
      dependencies: [{ name: "tslib", version: "2.8.2", integrity: "sha512-y" }],
    };

    expect(computeHash(inputV1, { repoRoot })).not.toBe(
      computeHash(inputV2, { repoRoot })
    );
  });

  test("is not sensitive to the order local files are passed in", () => {
    const fileA = writeFile("a.ts", "a-content");
    const fileB = writeFile("b.ts", "b-content");
    const inputForward = { localFiles: [fileA, fileB], dependencies: [] };
    const inputReversed = { localFiles: [fileB, fileA], dependencies: [] };

    expect(computeHash(inputForward, { repoRoot })).toBe(
      computeHash(inputReversed, { repoRoot })
    );
  });

  test("is not sensitive to the order dependencies are passed in", () => {
    const depA = { name: "a", version: "1.0.0", integrity: "sha512-a" };
    const depB = { name: "b", version: "1.0.0", integrity: "sha512-b" };
    const inputForward = { localFiles: [], dependencies: [depA, depB] };
    const inputReversed = { localFiles: [], dependencies: [depB, depA] };

    expect(computeHash(inputForward, { repoRoot })).toBe(
      computeHash(inputReversed, { repoRoot })
    );
  });

  test("produces a 64-character hex sha256 digest", () => {
    const file = writeFile("a.ts", "content");
    const input = { localFiles: [file], dependencies: [] };

    expect(computeHash(input, { repoRoot })).toMatch(/^[0-9a-f]{64}$/);
  });

  test("changes when a new dependency is added", () => {
    const inputWithoutDep = { localFiles: [], dependencies: [] };
    const inputWithDep = {
      localFiles: [],
      dependencies: [{ name: "tslib", version: "2.8.1", integrity: "sha512-x" }],
    };

    expect(computeHash(inputWithoutDep, { repoRoot })).not.toBe(
      computeHash(inputWithDep, { repoRoot })
    );
  });
});
