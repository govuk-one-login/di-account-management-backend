// Drift guard: fails when dev/local/functions.ts no longer matches
// template.yaml. Only names are compared, never resolved values.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EVENTS_DIR, SRC_DIR } from "../config.ts";
import { FUNCTIONS, TABLES, findFunction } from "../functions.ts";
import { loadTemplate } from "../template.ts";

const template = loadTemplate();

describe("local function manifest", () => {
  it("has a unique name and logical id per function", () => {
    const names = FUNCTIONS.map((fn) => fn.name);
    const logicalIds = FUNCTIONS.map((fn) => fn.logicalId);
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(logicalIds).size).toBe(logicalIds.length);
  });

  it("lists exactly the functions in template.yaml", () => {
    expect(FUNCTIONS.map((fn) => fn.logicalId).sort()).toEqual(
      template.functions.map((fn) => fn.logicalId).sort()
    );
  });

  it.each(FUNCTIONS.map((fn) => [fn.logicalId, fn] as const))(
    "%s matches the template",
    (logicalId, fn) => {
      const declared = template.functions.find(
        (f) => f.logicalId === logicalId
      );
      expect(declared, `${logicalId} is not in template.yaml`).toBeDefined();
      expect(fn.handler).toBe(
        `${declared!.handlerFile}.${declared!.handlerExport}`
      );
      expect(Object.keys(fn.env).sort()).toEqual([...declared!.envKeys].sort());
      expect(
        existsSync(join(SRC_DIR, `${declared!.handlerFile}.ts`)),
        `src/${declared!.handlerFile}.ts does not exist`
      ).toBe(true);
    }
  );

  it("has a sample event for every verified function", () => {
    for (const fn of FUNCTIONS.filter((f) => f.status === "verified")) {
      expect(existsSync(join(EVENTS_DIR, `${fn.name}.json`)), fn.name).toBe(
        true
      );
    }
  });

  it("explains why each unverified function is unverified", () => {
    for (const fn of FUNCTIONS.filter((f) => f.status === "unverified")) {
      expect(fn.notes, fn.name).toBeTruthy();
    }
  });

  it("only references queues that exist in the template", () => {
    for (const fn of FUNCTIONS) {
      for (const value of Object.values(fn.env)) {
        if (typeof value === "object" && "queue" in value) {
          expect(
            template.queueLogicalIds,
            `${fn.name}: ${value.queue}`
          ).toContain(value.queue);
        }
      }
    }
  });

  it("uses table names that the template creates", () => {
    const names = template.tables.map((table) => table.tableName);
    for (const name of Object.values(TABLES)) {
      expect(names).toContain(name);
    }
  });

  it("finds functions by name", () => {
    expect(findFunction("write-activity-log")?.logicalId).toBe(
      "WriteActivityLogFunction"
    );
    expect(findFunction("nope")).toBeUndefined();
  });
});
