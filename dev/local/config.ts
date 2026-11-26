// Shared constants for the local AWS Emulator tooling. See
// docs/local-development.md.

import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const EMULATOR_PORT = 9297;
export const REGION = "eu-west-2";
// The emulator runs everything in this single account.
export const ACCOUNT_ID = "000000000000";
// Used wherever the template says ${AWS::StackName}. "home-backend" is the
// default the integration test config uses for the same purpose.
export const STACK_NAME = "home-backend";

export const REPO_ROOT = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../.."
);
export const TEMPLATE_PATH = join(REPO_ROOT, "template.yaml");
export const SRC_DIR = join(REPO_ROOT, "src");
export const EVENTS_DIR = join(REPO_ROOT, "dev/local/events");
// Bundled handlers are written here (git-ignored).
export const BUILD_DIR = join(REPO_ROOT, "dev/local/.build");

const emulatorHome = join(homedir(), ".aws/emulator");
// Written by bootstrap.ts (queue URLs, key ARNs...). Deleted by down.sh,
// because the emulator keeps all of its state in memory only.
export const RESOURCES_FILE = join(
  emulatorHome,
  `${EMULATOR_PORT}.resources.json`
);

export interface LocalResources {
  queueUrls: Record<string, string>;
  keyArns: { generator: string; wrapper: string; backupWrapper: string };
}

// How far each stream-triggered function has read. Written by stream.ts and
// deleted by down.sh together with the emulator state it refers to.
export const STREAM_CHECKPOINTS_FILE = join(
  emulatorHome,
  `${EMULATOR_PORT}.stream-checkpoints.json`
);
