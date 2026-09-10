import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  extractImportSpecifiers,
  resolveLocalImport,
  packageNameFromSpecifier,
  walkLocalImportGraph,
} from "./import-graph.js";

let fixtureDir: string;

beforeEach(() => {
  fixtureDir = mkdtempSync(join(tmpdir(), "import-graph-test-"));
});

afterEach(() => {
  rmSync(fixtureDir, { recursive: true, force: true });
});

describe("extractImportSpecifiers", () => {
  test("extracts import declarations", () => {
    const file = join(fixtureDir, "a.ts");
    writeFileSync(
      file,
      `import { foo } from "./foo.js";\nimport bar from "bar-package";\n`
    );

    expect(extractImportSpecifiers(file)).toEqual(["./foo.js", "bar-package"]);
  });

  test("extracts export-from declarations", () => {
    const file = join(fixtureDir, "a.ts");
    writeFileSync(file, `export { foo } from "./foo.js";\n`);

    expect(extractImportSpecifiers(file)).toEqual(["./foo.js"]);
  });

  test("extracts import type declarations", () => {
    const file = join(fixtureDir, "a.ts");
    writeFileSync(file, `import type { Foo } from "./model.js";\n`);

    expect(extractImportSpecifiers(file)).toEqual(["./model.js"]);
  });

  test("returns an empty array when there are no imports", () => {
    const file = join(fixtureDir, "a.ts");
    writeFileSync(file, `export const x = 1;\n`);

    expect(extractImportSpecifiers(file)).toEqual([]);
  });

  test("ignores the string 'import' appearing in a comment", () => {
    const file = join(fixtureDir, "a.ts");
    writeFileSync(file, `// import { notReal } from "./nope.js";\nexport const x = 1;\n`);

    expect(extractImportSpecifiers(file)).toEqual([]);
  });

  test("extracts a json import with a type attribute clause", () => {
    const file = join(fixtureDir, "a.ts");
    writeFileSync(
      file,
      `import data from "./data.json" with { type: "json" };\n`
    );

    expect(extractImportSpecifiers(file)).toEqual(["./data.json"]);
  });
});

describe("resolveLocalImport", () => {
  test("resolves a .js-suffixed relative import to its .ts source file", () => {
    const fromFile = join(fixtureDir, "a.ts");
    writeFileSync(join(fixtureDir, "model.ts"), "export const x = 1;\n");

    expect(resolveLocalImport("./model.js", fromFile)).toBe(
      join(fixtureDir, "model.ts")
    );
  });

  test("resolves an index.ts when importing a directory", () => {
    const fromFile = join(fixtureDir, "a.ts");
    const subDir = join(fixtureDir, "sub");
    mkdirSync(subDir);
    writeFileSync(join(subDir, "index.ts"), "export const x = 1;\n");

    expect(resolveLocalImport("./sub.js", fromFile)).toBe(
      join(fixtureDir, "sub/index.ts")
    );
  });

  test("resolves a .json import to the json file directly", () => {
    const fromFile = join(fixtureDir, "a.ts");
    writeFileSync(join(fixtureDir, "data.json"), `{"x": 1}`);

    expect(resolveLocalImport("./data.json", fromFile)).toBe(
      join(fixtureDir, "data.json")
    );
  });

  test("throws when a .json import cannot be resolved", () => {
    const fromFile = join(fixtureDir, "a.ts");

    expect(() => resolveLocalImport("./missing.json", fromFile)).toThrow(
      /Could not resolve local import/
    );
  });

  test("throws when the local import cannot be resolved", () => {
    const fromFile = join(fixtureDir, "a.ts");

    expect(() => resolveLocalImport("./missing.js", fromFile)).toThrow(
      /Could not resolve local import/
    );
  });
});

describe("packageNameFromSpecifier", () => {
  test("returns the package name for an unscoped import", () => {
    expect(packageNameFromSpecifier("typescript")).toBe("typescript");
  });

  test("returns the package name for a subpath import", () => {
    expect(packageNameFromSpecifier("some-package/dist/index")).toBe(
      "some-package"
    );
  });

  test("returns the scope and name for a scoped import", () => {
    expect(packageNameFromSpecifier("@aws-sdk/client-dynamodb")).toBe(
      "@aws-sdk/client-dynamodb"
    );
  });

  test("returns the scope and name for a scoped subpath import", () => {
    expect(
      packageNameFromSpecifier("@aws-sdk/client-dynamodb/dist-cjs/index")
    ).toBe("@aws-sdk/client-dynamodb");
  });
});

describe("walkLocalImportGraph", () => {
  test("collects local files and npm roots across a local import chain", () => {
    writeFileSync(
      join(fixtureDir, "entry.ts"),
      `import { helper } from "./helper.js";\nimport { DynamoDBClient } from "@aws-sdk/client-dynamodb";\n`
    );
    writeFileSync(
      join(fixtureDir, "helper.ts"),
      `import type { Model } from "./model.js";\nimport { z } from "valibot";\n`
    );
    writeFileSync(join(fixtureDir, "model.ts"), `export const x = 1;\n`);

    const { localFiles, npmRoots } = walkLocalImportGraph(
      join(fixtureDir, "entry.ts")
    );

    expect([...localFiles].sort()).toEqual(
      [
        join(fixtureDir, "entry.ts"),
        join(fixtureDir, "helper.ts"),
        join(fixtureDir, "model.ts"),
      ].sort()
    );
    expect([...npmRoots].sort()).toEqual(["@aws-sdk/client-dynamodb", "valibot"]);
  });

  test("does not revisit a file more than once when imports are circular", () => {
    writeFileSync(
      join(fixtureDir, "a.ts"),
      `import { b } from "./b.js";\n`
    );
    writeFileSync(
      join(fixtureDir, "b.ts"),
      `import { a } from "./a.js";\n`
    );

    const { localFiles } = walkLocalImportGraph(join(fixtureDir, "a.ts"));

    expect(localFiles.size).toBe(2);
  });

  test("returns only the entry point when it has no imports", () => {
    writeFileSync(join(fixtureDir, "entry.ts"), `export const x = 1;\n`);

    const { localFiles, npmRoots } = walkLocalImportGraph(
      join(fixtureDir, "entry.ts")
    );

    expect([...localFiles]).toEqual([join(fixtureDir, "entry.ts")]);
    expect(npmRoots.size).toBe(0);
  });
});
