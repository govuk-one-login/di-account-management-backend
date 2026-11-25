// Interactively adds TxMA events to the local TxMA input queue, and runs the
// raw events Lambda (save-raw-events) on whatever is queued.
//
//   npm run local:send-event
//
// Nothing consumes the queues locally, so "run the Lambda" below does what the
// SQS event source mapping would do in AWS: receive the messages, invoke
// save-raw-events with them, and delete the ones that succeeded.

import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { join } from "node:path";
import {
  DeleteMessageBatchCommand,
  GetQueueAttributesCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
  type Message,
} from "@aws-sdk/client-sqs";
import { REPO_ROOT } from "./config.ts";
import { assertEmulatorEnvironment, loadResources } from "./runtime.ts";
import {
  buildEvent,
  EVENTS,
  parseExtra,
  parseTimestamp,
  type EventAnswers,
  type EventSpec,
} from "./txma.ts";

// The queues save-raw-events reads from (SaveRawEventsFunction in
// template.yaml).
const QUEUES = ["TxMAInputDummyQueue", "TxMAIADInputDummyQueue"];

const sqs = new SQSClient({});
const rl = createInterface({ input: process.stdin, output: process.stdout });

const ask = async (question: string, fallback = ""): Promise<string> => {
  const suffix = fallback ? ` [${fallback}]` : "";
  const answer = (await rl.question(`${question}${suffix}: `)).trim();
  return answer || fallback;
};

const choose = async <T>(
  title: string,
  options: { label: string; value: T }[],
  fallbackIndex = 0
): Promise<T> => {
  console.log(`\n${title}`);
  options.forEach((option, index) =>
    console.log(`  ${index + 1}) ${option.label}`)
  );
  for (;;) {
    const answer = await ask("Choose", String(fallbackIndex + 1));
    const picked = options[Number(answer) - 1];
    if (picked) return picked.value;
    console.log(`Enter a number from 1 to ${options.length}.`);
  }
};

const queueUrl = (name: string): string => {
  const url = loadResources().queueUrls[name];
  if (!url) {
    throw new Error(
      `Queue ${name} not found. Run \`npm run local:bootstrap\`.`
    );
  }
  return url;
};

const queueDepth = async (url: string): Promise<string> => {
  const { Attributes } = await sqs.send(
    new GetQueueAttributesCommand({
      QueueUrl: url,
      AttributeNames: ["ApproximateNumberOfMessages"],
    })
  );
  return Attributes?.ApproximateNumberOfMessages ?? "?";
};

let lastUserId = `local-user-${Math.random().toString(36).slice(2, 8)}`;
let lastSessionId = `local-session-${Math.random().toString(36).slice(2, 8)}`;

const promptEvent = async (): Promise<EventAnswers> => {
  const spec: EventSpec | undefined = await choose<EventSpec | undefined>(
    "Event type",
    [
      ...EVENTS.map((event) => ({
        label: `${event.name}  (${event.description})`,
        value: event as EventSpec | undefined,
      })),
      { label: "Other: type an event name", value: undefined },
    ]
  );
  const eventName = spec ? spec.name : await ask("Event name");

  const userId = await ask(
    `User id${spec && !spec.requiresUserId ? " (blank = none)" : ""}`,
    spec && !spec.requiresUserId ? "" : lastUserId
  );
  if (userId) lastUserId = userId;

  const sessionId = await ask(
    `Session id${spec && !spec.requiresSessionId ? " (blank = none)" : ""}`,
    spec && !spec.requiresSessionId ? "" : lastSessionId
  );
  if (sessionId) lastSessionId = sessionId;

  const clientId = await ask(
    `Client id${spec && !spec.requiresClientId ? " (blank = none)" : ""}`,
    spec?.defaultClientId ?? ""
  );
  const email = await ask(
    "Email (blank = none; the tracker records it)",
    `${userId || "user"}@example.com`.replace(/[^\w@.+-]/g, "-")
  );
  const publicSubjectId = await ask(
    "Public subject id (blank = none)",
    userId ? `public-${userId}` : ""
  );

  let timestamp: number | undefined;
  while (timestamp === undefined) {
    try {
      timestamp = parseTimestamp(
        await ask("Time (now, ISO date, or unix seconds)", "now")
      );
    } catch (error) {
      console.log((error as Error).message);
    }
  }

  let extra: Record<string, unknown> | undefined;
  for (;;) {
    try {
      extra = parseExtra(
        await ask(
          'Extra fields as JSON to merge in, e.g. {"extensions":{"journey-type":"PASSWORD_RESET"}} (blank = none)'
        )
      );
      break;
    } catch (error) {
      console.log((error as Error).message);
    }
  }

  return {
    eventName,
    userId,
    sessionId,
    clientId,
    email,
    publicSubjectId,
    timestamp,
    extra,
  };
};

const addEvent = async (queueName: string): Promise<void> => {
  const event = buildEvent(await promptEvent());
  console.log(`\n${JSON.stringify(event, null, 2)}`);
  if ((await ask("Send to the queue? (y/n)", "y")).toLowerCase() !== "y") {
    console.log("Not sent.");
    return;
  }
  const { MessageId } = await sqs.send(
    new SendMessageCommand({
      QueueUrl: queueUrl(queueName),
      MessageBody: JSON.stringify(event),
    })
  );
  console.log(
    `Sent (${MessageId}). Messages in ${queueName}: ${await queueDepth(queueUrl(queueName))}`
  );
};

const receiveAll = async (url: string): Promise<Message[]> => {
  const messages: Message[] = [];
  for (let attempt = 0; attempt < 20; attempt++) {
    const { Messages = [] } = await sqs.send(
      new ReceiveMessageCommand({
        QueueUrl: url,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 1,
        VisibilityTimeout: 120,
      })
    );
    if (Messages.length === 0) break;
    messages.push(...Messages);
  }
  return messages;
};

/** Runs invoke.ts with the event on stdin, like `local:invoke -- <fn> -`. */
const invokeSaveRawEvents = (
  messages: Message[]
): { failedIds: Set<string>; ok: boolean; output: string } => {
  const event = {
    Records: messages.map((message) => ({
      messageId: message.MessageId,
      receiptHandle: message.ReceiptHandle,
      body: message.Body,
    })),
  };
  const result = spawnSync(
    process.execPath,
    [
      "--disable-warning=ExperimentalWarning",
      join(REPO_ROOT, "dev/local/invoke.ts"),
      "save-raw-events",
      "-",
    ],
    {
      env: process.env,
      cwd: REPO_ROOT,
      input: JSON.stringify(event),
      encoding: "utf8",
    }
  );

  const output = `${result.stdout}${result.stderr}`;
  const failedIds = new Set<string>();
  const marker = result.stdout.split("--- result ---")[1];
  let ok = false;
  if (marker) {
    try {
      const parsed = JSON.parse(marker.split("\n[local]")[0]) as {
        batchItemFailures?: { itemIdentifier: string }[];
      };
      for (const failure of parsed.batchItemFailures ?? []) {
        failedIds.add(failure.itemIdentifier);
      }
      ok = true;
    } catch {
      // Treated as a crash below.
    }
  }
  return { failedIds, ok, output };
};

const runLambda = async (queueName: string): Promise<void> => {
  const url = queueUrl(queueName);
  const messages = await receiveAll(url);
  if (messages.length === 0) {
    console.log(`No messages in ${queueName}.`);
    return;
  }
  console.log(`Running save-raw-events on ${messages.length} message(s)...\n`);
  const { failedIds, ok, output } = invokeSaveRawEvents(messages);
  console.log(output.trim());

  if (!ok) {
    console.log(
      "\nThe Lambda crashed, so nothing was deleted. The messages return to the queue shortly."
    );
    return;
  }
  const done = messages.filter((m) => !failedIds.has(m.MessageId ?? ""));
  for (let i = 0; i < done.length; i += 10) {
    await sqs.send(
      new DeleteMessageBatchCommand({
        QueueUrl: url,
        Entries: done.slice(i, i + 10).map((m, index) => ({
          Id: String(index),
          ReceiptHandle: m.ReceiptHandle,
        })),
      })
    );
  }
  console.log(
    `\n${done.length} processed and removed from the queue, ${failedIds.size} failed (left on the queue).`
  );
};

const main = async (): Promise<void> => {
  assertEmulatorEnvironment();
  const queueName = await choose(
    "Queue",
    QUEUES.map((name) => ({ label: name, value: name }))
  );
  console.log(`\nUsing ${queueName}: ${queueUrl(queueName)}`);

  for (;;) {
    const action = await choose(`What next? (${queueName})`, [
      { label: "Add an event", value: "add" },
      { label: "Run save-raw-events on the queued events", value: "run" },
      { label: "Show how many messages are queued", value: "depth" },
      { label: "Quit", value: "quit" },
    ]);
    if (action === "quit") return;
    try {
      if (action === "add") await addEvent(queueName);
      else if (action === "run") await runLambda(queueName);
      else console.log(`Queued: ${await queueDepth(queueUrl(queueName))}`);
    } catch (error) {
      console.log(`Error: ${(error as Error).message}`);
    }
  }
};

main().then(
  () => {
    rl.close();
    process.exit(0);
  },
  (error: unknown) => {
    rl.close();
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
);
