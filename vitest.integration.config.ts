import { cpus } from "node:os";
import { defineConfig } from "vitest/config";

// At most one worker per available CPU core, capped at 5 to match the blast
// radius of the old Python suite (ThreadPoolExecutor max_workers=5) against
// real deployed AWS.
const MAX_WORKERS = 5;
const workerCount = Math.min(MAX_WORKERS, Math.max(1, cpus().length));

export default defineConfig({
  test: {
    // The integration suite exercises real deployed AWS infrastructure and is
    // run only via `npm run test:integration`, never by the default unit run.
    include: ["pre-merge-integration-tests/tests/**/*.integration.test.ts"],
    // No unit-test setup file (src/tests/setup.ts) is applied here.
    setupFiles: [],
    // Discovering zero integration files must be a non-zero exit.
    passWithNoTests: false,
    // Run cases concurrently with at most one worker per CPU core, capped at 5
    // (the forks pool uses one worker per fork, so maxWorkers caps concurrent
    // forks — and therefore the number of simultaneous AWS calls).
    pool: "forks",
    maxWorkers: workerCount,
    // These cases hit real deployed AWS and deliberately wait on eventual
    // consistency: polling the activity_log for up to 30s (pollForItem) and a
    // delayed "no item" assertion (assertNoItem), plus the SQS send and any
    // seed write beforehand. Vitest's 5s default is far too low, so raise the
    // per-test timeout to sit comfortably above the longest in-test wait.
    testTimeout: 40_000,
  },
});
