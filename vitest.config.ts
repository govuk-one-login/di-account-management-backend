import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    clearMocks: true,
    setupFiles: ["src/tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "clover", "json"],
      reportsDirectory: "coverage",
    },
    include: ["**/tests/*/*.test.ts", "**/tests/*.test.ts"],
  },
});
