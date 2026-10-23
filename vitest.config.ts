import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["src/tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "clover", "json"],
      reportsDirectory: "coverage",
    },
    include: [
      "**/tests/*/*.test.ts",
      "**/tests/*.test.ts",
      "scripts/hash-iad-query-logic/*.test.ts",
    ],
    // Preserve Vitest's default excludes and keep integration tests out of the
    // unit run so `npm test` never discovers them.
    exclude: [
      ...configDefaults.exclude,
      "pre-merge-integration-tests/tests/**/*.integration.test.ts",
    ],
  },
});
