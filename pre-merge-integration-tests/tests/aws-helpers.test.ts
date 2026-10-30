// Unit tests for the pre-merge integration-suite AWS helpers. The real
// functions talk to deployed AWS infra; here the SDK clients and `fetch` are
// mocked, so these run in the normal `npm test` unit run.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

import {
  assertNoItem,
  deleteItem,
  getSecret,
  pollForItem,
  sendMessage,
  type MatchCriteria,
} from "../aws-helpers.js";

const sqsMock = mockClient(SQSClient);
const secretsMock = mockClient(SecretsManagerClient);
const docMock = mockClient(DynamoDBDocumentClient);

const CRITERIA: MatchCriteria = {
  keyConditionExpression: "#pk = :pk",
  expressionAttributeNames: { "#pk": "user_id" },
  expressionAttributeValues: { ":pk": "premerge-x-1234" },
};

beforeEach(() => {
  sqsMock.reset();
  secretsMock.reset();
  docMock.reset();
  delete process.env.SQS_QUEUE_ARN;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("sendMessage", () => {
  const queueUrl = "https://sqs.eu-west-2.amazonaws.com/123/queue";

  it("throws MissingConfigError when the queue URL is unset", async () => {
    await expect(sendMessage({})).rejects.toMatchObject({
      name: "MissingConfigError",
      variableName: "SQS_QUEUE_ARN",
    });
  });

  it("JSON-serialises object payloads and returns the MessageId", async () => {
    process.env.SQS_QUEUE_ARN = queueUrl;
    sqsMock.on(SendMessageCommand).resolves({ MessageId: "msg-1" });

    const id = await sendMessage({ hello: "world" });

    expect(id).toBe("msg-1");
    const call = sqsMock.commandCalls(SendMessageCommand)[0];
    expect(call.args[0].input).toStrictEqual({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({ hello: "world" }),
    });
  });

  it("passes string payloads through unchanged", async () => {
    process.env.SQS_QUEUE_ARN = queueUrl;
    sqsMock.on(SendMessageCommand).resolves({ MessageId: "msg-2" });

    await sendMessage("raw-body");

    const call = sqsMock.commandCalls(SendMessageCommand)[0];
    expect(call.args[0].input.MessageBody).toBe("raw-body");
  });
});

describe("getSecret", () => {
  it("rejects an empty secret id without calling AWS", async () => {
    await expect(getSecret("")).rejects.toThrow(
      "an empty secret identifier was supplied"
    );
    expect(secretsMock.commandCalls(GetSecretValueCommand)).toHaveLength(0);
  });

  it("returns the secret string on success", async () => {
    secretsMock
      .on(GetSecretValueCommand)
      .resolves({ SecretString: "super-secret" }); // pragma: allowlist secret

    await expect(getSecret("arn:aws:secret:xyz")).resolves.toBe("super-secret");
  });

  it("throws when the secret string is empty", async () => {
    secretsMock.on(GetSecretValueCommand).resolves({ SecretString: "" });

    await expect(getSecret("arn:aws:secret:xyz")).rejects.toThrow(
      'Secret value for "arn:aws:secret:xyz" was empty'
    );
  });

  it("throws when the secret string is undefined", async () => {
    secretsMock.on(GetSecretValueCommand).resolves({});

    await expect(getSecret("arn:aws:secret:xyz")).rejects.toThrow(
      "was empty and could not be used"
    );
  });
});

describe("pollForItem", () => {
  it("returns the first matching item on the first attempt", async () => {
    docMock.on(QueryCommand).resolves({ Items: [{ id: "a" }] });

    const item = await pollForItem("activity_log", CRITERIA);

    expect(item).toStrictEqual({ id: "a" });
  });

  it("passes the index name through to the query", async () => {
    docMock.on(QueryCommand).resolves({ Items: [{ id: "a" }] });

    await pollForItem("activity_log", CRITERIA, { indexName: "gsi-1" });

    const call = docMock.commandCalls(QueryCommand)[0];
    expect(call.args[0].input.IndexName).toBe("gsi-1");
  });

  it("times out and reports the query errors when every attempt fails", async () => {
    vi.useFakeTimers();
    docMock.on(QueryCommand).rejects(new Error("boom"));

    const promise = pollForItem("activity_log", CRITERIA, {
      timeoutSeconds: 0,
      description: "my check",
    });
    const assertion = expect(promise).rejects.toThrow(
      /No item was found in table "activity_log".*for my check.*Every query attempt returned a DynamoDB error/s
    );
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("times out without the error clause when a query returned no items", async () => {
    vi.useFakeTimers();
    docMock.on(QueryCommand).resolves({ Items: [] });

    const promise = pollForItem("activity_log", CRITERIA, {
      timeoutSeconds: 0,
    });
    const assertion = expect(promise).rejects.toThrow(/within 0s\.$/);
    await vi.runAllTimersAsync();
    await assertion;
  });
});

describe("assertNoItem", () => {
  it("resolves when no items match after the delay", async () => {
    vi.useFakeTimers();
    docMock.on(QueryCommand).resolves({ Items: [] });

    const promise = assertNoItem("activity_log", CRITERIA, {
      delaySeconds: 0,
    });
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBeUndefined();
  });

  it("resolves when the query returns no Items property at all", async () => {
    vi.useFakeTimers();
    docMock.on(QueryCommand).resolves({});

    const promise = assertNoItem("activity_log", CRITERIA, {
      delaySeconds: 0,
    });
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBeUndefined();
  });

  it("throws reporting the match count when items are present", async () => {
    vi.useFakeTimers();
    docMock.on(QueryCommand).resolves({ Items: [{ id: "a" }, { id: "b" }] });

    const promise = assertNoItem("activity_log", CRITERIA, {
      delaySeconds: 0,
      indexName: "gsi-1",
      description: "dupe check",
    });
    const assertion = expect(promise).rejects.toThrow(
      /Expected no item in table "activity_log" \(index "gsi-1"\) for dupe check, but found 2 matching items\./
    );
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("propagates a non-abort query error", async () => {
    vi.useFakeTimers();
    docMock.on(QueryCommand).rejects(new Error("query failed"));

    const promise = assertNoItem("activity_log", CRITERIA, {
      delaySeconds: 0,
    });
    const assertion = expect(promise).rejects.toThrow("query failed");
    await vi.runAllTimersAsync();
    await assertion;
  });
});

describe("deleteItem", () => {
  it("sends a DeleteCommand with the supplied key", async () => {
    docMock.on(DeleteCommand).resolves({});

    await deleteItem("activity_log", { user_id: "premerge-x-1234" });

    const call = docMock.commandCalls(DeleteCommand)[0];
    expect(call.args[0].input).toStrictEqual({
      TableName: "activity_log",
      Key: { user_id: "premerge-x-1234" },
    });
  });

  it("swallows errors and logs a warning instead of throwing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    docMock.on(DeleteCommand).rejects(new Error("delete failed"));

    await expect(
      deleteItem("activity_log", { user_id: "x" })
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toContain('table "activity_log"');
  });
});
