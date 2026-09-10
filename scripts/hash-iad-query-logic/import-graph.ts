import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import ts from "typescript";

/**
 * Extracts module specifiers from import/export-from/import-type declarations.
 *
 * @example
 * // file.ts contains: import { foo } from "./bar.js"; import ts from "typescript";
 * extractImportSpecifiers("file.ts")
 * // => ["./bar.js", "typescript"]
 */
export function extractImportSpecifiers(filePath: string): string[] {
  const source = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true
  );

  const specifiers: string[] = [];

  const visit = (node: ts.Node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return specifiers;
}

/**
 * Resolves a relative import specifier (e.g. "./model.js") to a source file on disk.
 * JSON imports (e.g. "./data.json") resolve directly since they have no
 * separate .ts source - what's on disk is the actual imported file.
 *
 * @example
 * resolveLocalImport("./model.js", "/repo/src/common/query-inactive-accounts.ts")
 * // => "/repo/src/common/model.ts"
 */
export function resolveLocalImport(specifier: string, fromFile: string): string {
  if (specifier.endsWith(".json")) {
    const jsonPath = resolve(dirname(fromFile), specifier);
    if (existsSync(jsonPath)) {
      return jsonPath;
    }
    console.error(`Could not resolve "${specifier}" from ${fromFile}. Tried: ${jsonPath}`);
    throw new Error(
      `Could not resolve local import "${specifier}" from ${fromFile}`
    );
  }

  const withoutExtension = specifier.replace(/\.js$/, "");
  const base = resolve(dirname(fromFile), withoutExtension);
  const candidates = [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  console.error(
    `Could not resolve "${specifier}" from ${fromFile}. Tried: ${candidates.join(", ")}`
  );
  throw new Error(
    `Could not resolve local import "${specifier}" from ${fromFile}`
  );
}

/**
 * Returns the npm package name a bare import specifier belongs to (handles scoped packages).
 *
 * @example
 * packageNameFromSpecifier("@aws-sdk/client-dynamodb/dist-cjs/foo") // => "@aws-sdk/client-dynamodb"
 */
export function packageNameFromSpecifier(specifier: string): string {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];
}

export interface LocalImportGraph {
  localFiles: Set<string>;
  npmRoots: Set<string>;
}

/**
 * Walks the import graph from the entry point, following relative
 * imports on disk and collecting npm package names from bare imports.
 *
 * @example
 * // query-inactive-accounts.ts imports "./model.js" and "@aws-sdk/lib-dynamodb"
 * walkLocalImportGraph("/repo/src/common/query-inactive-accounts.ts")
 * // => {
 * //   localFiles: Set(["/repo/src/common/query-inactive-accounts.ts", "/repo/src/common/model.ts"]),
 * //   npmRoots: Set(["@aws-sdk/lib-dynamodb"]),
 * // }
 */
export function walkLocalImportGraph(entryPoint: string): LocalImportGraph {
  const localFiles = new Set<string>();
  const npmRoots = new Set<string>();
  const stack = [entryPoint];

  while (stack.length > 0) {
    const file = stack.pop() as string;
    if (localFiles.has(file)) {
      continue;
    }
    localFiles.add(file);

    for (const specifier of extractImportSpecifiers(file)) {
      if (specifier.startsWith(".")) {
        stack.push(resolveLocalImport(specifier, file));
      } else {
        npmRoots.add(packageNameFromSpecifier(specifier));
      }
    }
  }

  return { localFiles, npmRoots };
}
