// Runs each verified Lambda with its sample event (dev/local/events) against
// the emulator and checks the DynamoDB items it should have written.
//
//   npm run local:verify
//
// This is repeatable manual verification, it is not part of CI. Each function
// runs in its own process (as invoke.ts does) because some modules read their
// configuration at import time.

import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { REPO_ROOT } from "./config.ts";
import { FUNCTIONS, TABLES } from "./functions.ts";
import { assertEmulatorEnvironment } from "./runtime.ts";

const docs = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// Ids used by the sample events.
const USER_ID = "local-verify-user-1";
const ACTIVITY_EVENT_ID = "local-verify-event-1";
const RAW_EVENT_ID = "local-verify-raw-event-1";
const TRACKER_USER_ID = "local-verify-tracker-user-1";

const rawEventItems = async () => {
  const items: Record<string, unknown>[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const page = await docs.send(
      new ScanCommand({
        TableName: TABLES.rawEvents,
        FilterExpression: "#event.#eventId = :eventId",
        ExpressionAttributeNames: { "#event": "event", "#eventId": "event_id" },
        ExpressionAttributeValues: { ":eventId": RAW_EVENT_ID },
        ExclusiveStartKey,
      })
    );
    items.push(...(page.Items ?? []));
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
};

const trackerItems = async () => {
  const { Items = [] } = await docs.send(
    new QueryCommand({
      TableName: TABLES.tracker,
      IndexName: "CommonSubjectIdIndex",
      KeyConditionExpression: "commonSubjectId = :id",
      ExpressionAttributeValues: { ":id": TRACKER_USER_ID },
    })
  );
  return Items;
};

interface Case {
  fn: string;
  /** Removes anything left by a previous run, so a pass proves a fresh write. */
  clean: () => Promise<void>;
  /** Throws if the handler's effects are not as expected. */
  assert: () => Promise<void>;
}

const expect = (condition: unknown, message: string): void => {
  if (!condition) throw new Error(message);
};

const CASES: Case[] = [
  {
    fn: "save-raw-events",
    clean: async () => {
      for (const item of await rawEventItems()) {
        await docs.send(
          new DeleteCommand({
            TableName: TABLES.rawEvents,
            Key: { id: item.id as string, timestamp: item.timestamp as number },
          })
        );
      }
    },
    assert: async () => {
      const items = await rawEventItems();
      expect(items.length === 1, `expected 1 raw event, found ${items.length}`);
      expect(items[0].remove_at, "raw event has no remove_at TTL attribute");
    },
  },
  {
    fn: "write-user-services",
    clean: async () => {
      await docs.send(
        new DeleteCommand({
          TableName: TABLES.userServices,
          Key: { user_id: USER_ID },
        })
      );
    },
    assert: async () => {
      const { Item } = await docs.send(
        new GetCommand({
          TableName: TABLES.userServices,
          Key: { user_id: USER_ID },
        })
      );
      expect(Item, "no user_services item written");
      expect(
        Item?.services?.[0]?.client_id === "vehicleOperatorLicense",
        "services were not stored as sent"
      );
    },
  },
  {
    fn: "write-activity-log",
    clean: async () => {
      await docs.send(
        new DeleteCommand({
          TableName: TABLES.activityLog,
          Key: { user_id: USER_ID, event_id: ACTIVITY_EVENT_ID },
        })
      );
    },
    assert: async () => {
      const { Item } = await docs.send(
        new GetCommand({
          TableName: TABLES.activityLog,
          Key: { user_id: USER_ID, event_id: ACTIVITY_EVENT_ID },
        })
      );
      expect(Item, "no activity_log item written");
      expect(
        typeof Item?.event_type === "string" &&
          Item.event_type !== "AUTH_AUTH_CODE_ISSUED",
        "event_type was stored unencrypted"
      );
    },
  },
  {
    fn: "update-inactive-account-tracker",
    clean: async () => {
      for (const item of await trackerItems()) {
        await docs.send(
          new DeleteCommand({
            TableName: TABLES.tracker,
            Key: {
              dateForDeletion: item.dateForDeletion as string,
              commonSubjectId: TRACKER_USER_ID,
            },
          })
        );
      }
    },
    assert: async () => {
      const items = await trackerItems();
      expect(
        items.length === 1,
        `expected 1 tracker record, found ${items.length}`
      );
      expect(items[0].status === "pending", `status is ${items[0].status}`);
      expect(
        items[0].emailAddress === "local-verify@example.com",
        "email address was not recorded"
      );
    },
  },
];

const invoke = (name: string): { ok: boolean; output: string } => {
  const result = spawnSync(
    process.execPath,
    [
      "--disable-warning=ExperimentalWarning",
      join(REPO_ROOT, "dev/local/invoke.ts"),
      name,
    ],
    { env: process.env, encoding: "utf8", cwd: REPO_ROOT }
  );
  return {
    ok: result.status === 0,
    output: `${result.stdout}${result.stderr}`.trim(),
  };
};

const main = async (): Promise<number> => {
  assertEmulatorEnvironment();

  const verified = FUNCTIONS.filter((fn) => fn.status === "verified").map(
    (fn) => fn.name
  );
  const uncovered = verified.filter(
    (name) => !CASES.some((c) => c.fn === name)
  );
  if (uncovered.length > 0) {
    throw new Error(
      `Verified functions without a case: ${uncovered.join(", ")}`
    );
  }

  let failures = 0;
  for (const testCase of CASES) {
    let problem: string | undefined;
    try {
      await testCase.clean();
      const { ok, output } = invoke(testCase.fn);
      if (ok) {
        await testCase.assert();
      } else {
        problem = `handler failed:\n${output}`;
      }
    } catch (error) {
      problem = (error as Error).message;
    }
    if (problem) {
      failures++;
      console.log(
        `FAIL  ${testCase.fn}\n      ${problem.replaceAll("\n", "\n      ")}`
      );
    } else {
      console.log(`PASS  ${testCase.fn}`);
    }
  }
  return failures === 0 ? 0 : 1;
};

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
);
