import { cpus } from "node:os";
import { defineConfig } from "vitest/config";

// At most one worker per available CPU core.
const coreCount = Math.max(1, cpus().length);

export default defineConfig({
  test: {
    // The integration suite exercises real deployed AWS infrastructure and is
    // run only via `npm run test:integration`, never by the default unit run.
    include: ["pre-merge-integration-tests/tests/**/*.integration.test.ts"],
    // No unit-test setup file (src/tests/setup.ts) is applied here.
    setupFiles: [],
    // Discovering zero integration files must be a non-zero exit.
    passWithNoTests: false,
    // Run cases concurrently with at most one worker per CPU core (the forks
    // pool uses one worker per fork, so maxWorkers caps forks at the core count).
    pool: "forks",
    maxWorkers: coreCount,
    // A type error in any integration test file fails the run.
    typecheck: {
      enabled: true,
      include: ["pre-merge-integration-tests/tests/**/*.integration.test.ts"],
    },
  },
});
