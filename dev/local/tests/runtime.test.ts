import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { LocalResources } from "../config.ts";
import { findFunction, type LocalFunction } from "../functions.ts";
import {
  assertEmulatorEnvironment,
  buildContext,
  lambdaRuntimeEnv,
  loadEvent,
  loadHandler,
  normaliseEvent,
  parseArgs,
  resolveEnv,
} from "../runtime.ts";

const resources: LocalResources = {
  queueUrls: { NotificationQueue: "https://q/notification" },
  keyArns: { generator: "g", wrapper: "w", backupWrapper: "b" },
};

const fakeFn = (env: LocalFunction["env"]): LocalFunction => ({
  name: "fake",
  logicalId: "FakeFunction",
  handler: "fake.handler",
  trigger: "invoke",
  status: "unverified",
  notes: "test",
  env,
});

const emulatorEnv = {
  AWS_ENDPOINT_URL: "https://127.0.0.1:9297",
  AWS_SHARED_CREDENTIALS_FILE:
    "/home/me/.aws/emulator/9297/emulator_credentials",
};

describe("assertEmulatorEnvironment", () => {
  it("accepts a loopback endpoint with the emulator's credentials", () => {
    expect(() => assertEmulatorEnvironment(emulatorEnv)).not.toThrow();
  });

  it("refuses when the emulator credentials file is not used", () => {
    expect(() =>
      assertEmulatorEnvironment({
        AWS_ENDPOINT_URL: emulatorEnv.AWS_ENDPOINT_URL,
      })
    ).toThrow(/AWS_SHARED_CREDENTIALS_FILE/);
  });

  it("refuses when no endpoint is set", () => {
    expect(() => assertEmulatorEnvironment({})).toThrow(/AWS_ENDPOINT_URL/);
  });

  it("refuses a non-local endpoint", () => {
    expect(() =>
      assertEmulatorEnvironment({
        ...emulatorEnv,
        AWS_ENDPOINT_URL: "https://dynamodb.eu-west-2.amazonaws.com",
      })
    ).toThrow(/Refusing/);
  });

  it("refuses when real credentials are present", () => {
    expect(() =>
      assertEmulatorEnvironment({
        ...emulatorEnv,
        AWS_ACCESS_KEY_ID: "AKIAEXAMPLE",
      })
    ).toThrow(/credentials/);
  });
});

describe("resolveEnv", () => {
  it("passes strings through, and resolves queues and keys", () => {
    const env = resolveEnv(
      fakeFn({
        PLAIN: "x",
        QUEUE: { queue: "NotificationQueue" },
        KEY: { key: "wrapper" },
      }),
      () => resources
    );
    expect(env).toEqual({
      PLAIN: "x",
      QUEUE: "https://q/notification",
      KEY: "w",
    });
  });

  it("does not need the resources file when nothing references it", () => {
    const env = resolveEnv(fakeFn({ PLAIN: "x" }), () => {
      throw new Error("should not be read");
    });
    expect(env).toEqual({ PLAIN: "x" });
  });

  it("explains how to fix a missing queue", () => {
    expect(() =>
      resolveEnv(fakeFn({ Q: { queue: "Nope" } }), () => resources)
    ).toThrow(/local:bootstrap/);
  });
});

describe("lambda runtime", () => {
  const fn = fakeFn({});

  it("provides the runtime environment variables", () => {
    expect(lambdaRuntimeEnv(fn)).toMatchObject({
      AWS_REGION: "eu-west-2",
      AWS_LAMBDA_FUNCTION_NAME: "local-home-backend-fake",
    });
  });

  it("builds a context with a working deadline", () => {
    const context = buildContext(fn, 5_000);
    expect(context.functionName).toBe("local-home-backend-fake");
    expect(context.getRemainingTimeInMillis()).toBeLessThanOrEqual(5_000);
    expect(context.getRemainingTimeInMillis()).toBeGreaterThan(0);
  });
});

describe("normaliseEvent", () => {
  it("stringifies object SQS bodies and fills in record defaults", () => {
    const event = normaliseEvent({
      Records: [{ body: { a: 1 } }, { body: "raw", messageId: "mine" }],
    }) as { Records: Record<string, unknown>[] };
    expect(event.Records[0].body).toBe('{"a":1}');
    expect(event.Records[0].messageId).toBe("local-message-0");
    expect(event.Records[0].eventSource).toBe("aws:sqs");
    expect(event.Records[1].body).toBe("raw");
    expect(event.Records[1].messageId).toBe("mine");
  });

  it("leaves DynamoDB stream and other events untouched", () => {
    const stream = { Records: [{ eventName: "INSERT", dynamodb: {} }] };
    expect(normaliseEvent(stream)).toBe(stream);
    const other = { hello: "world" };
    expect(normaliseEvent(other)).toBe(other);
  });
});

describe("loadEvent", () => {
  const fn = fakeFn({});
  const dir = mkdtempSync(join(tmpdir(), "local-events-"));

  it("reads an explicit file", () => {
    const file = join(dir, "e.json");
    writeFileSync(file, JSON.stringify({ x: 1 }));
    expect(loadEvent(fn, file)).toEqual({ x: 1 });
  });

  it("falls back to the sample event named after the function", () => {
    writeFileSync(join(dir, "fake.json"), JSON.stringify({ sample: true }));
    expect(loadEvent(fn, undefined, undefined, dir)).toEqual({ sample: true });
  });

  it("reads stdin for '-'", () => {
    expect(loadEvent(fn, "-", () => '{"fromStdin":true}')).toEqual({
      fromStdin: true,
    });
  });

  it("explains a missing file", () => {
    expect(() => loadEvent(fn, join(dir, "missing.json"))).toThrow(/not found/);
    expect(() => loadEvent(fn, undefined, undefined, join(dir, "x"))).toThrow(
      /no sample event/
    );
  });
});

describe("parseArgs", () => {
  it("separates flags from the function and event", () => {
    expect(parseArgs(["write-activity-log", "event.json"])).toEqual({
      list: false,
      noLogs: false,
      functionName: "write-activity-log",
      eventSource: "event.json",
    });
    expect(parseArgs(["--list"]).list).toBe(true);
    expect(parseArgs(["fn", "--no-logs"])).toMatchObject({
      noLogs: true,
      functionName: "fn",
    });
  });
});

describe("loadHandler", () => {
  it("bundles a real handler from src/ and returns its export", async () => {
    const fn = findFunction("write-user-services")!;
    const handler = await loadHandler(fn);
    expect(typeof handler).toBe("function");
  });

  it("fails clearly when the export is missing", async () => {
    const fn = {
      ...findFunction("write-user-services")!,
      name: "write-user-services-bad-export",
      handler: "write-user-services.nope",
    };
    await expect(loadHandler(fn)).rejects.toThrow(/did not export/);
  });
});
