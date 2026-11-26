// Checks which of the AWS operations this repo relies on work on the emulator
// you are running. Creates throw-away resources prefixed "smoke-" and deletes
// them again.
//
//   npm run local:smoke
//
// Exit code is 1 when any check fails, so gaps are impossible to miss.

import { randomUUID } from "node:crypto";
import {
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  UpdateTimeToLiveCommand,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  CreateQueueCommand,
  DeleteMessageCommand,
  DeleteQueueCommand,
  ReceiveMessageCommand,
  SendMessageBatchCommand,
  SendMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";
import {
  CreateTopicCommand,
  DeleteTopicCommand,
  PublishCommand,
  SNSClient,
} from "@aws-sdk/client-sns";
import {
  CreateKeyCommand,
  DecryptCommand,
  GenerateDataKeyCommand,
  KMSClient,
  ScheduleKeyDeletionCommand,
} from "@aws-sdk/client-kms";
import {
  CreateSecretCommand,
  DeleteSecretCommand,
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { ACCOUNT_ID } from "./config.ts";
import { assertEmulatorEnvironment } from "./runtime.ts";

interface Result {
  group: string;
  check: string;
  ok: boolean;
  skipped?: boolean;
  detail?: string;
}

const results: Result[] = [];

const check = async (
  group: string,
  name: string,
  action: () => Promise<void>
): Promise<void> => {
  try {
    await action();
    results.push({ group, check: name, ok: true });
  } catch (error) {
    const { name: errorName, message } = error as Error;
    results.push({
      group,
      check: name,
      ok: false,
      detail: `${errorName}: ${message}`.slice(0, 160),
    });
  }
};

const expect = (condition: unknown, message: string): void => {
  if (!condition) throw new Error(message);
};

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

const run = `smoke-${randomUUID().slice(0, 8)}`;

const dynamo = new DynamoDBClient({});
const docs = DynamoDBDocumentClient.from(dynamo);
const sqs = new SQSClient({});
const sns = new SNSClient({});
const kms = new KMSClient({});
const secrets = new SecretsManagerClient({});

const smokeDynamo = async (): Promise<void> => {
  const TableName = `${run}-table`;
  const group = "dynamodb";

  await check(group, "CreateTable with GSI", async () => {
    await dynamo.send(
      new CreateTableCommand({
        TableName,
        BillingMode: "PAY_PER_REQUEST",
        AttributeDefinitions: [
          { AttributeName: "pk", AttributeType: "S" },
          { AttributeName: "sk", AttributeType: "S" },
          { AttributeName: "email", AttributeType: "S" },
        ],
        KeySchema: [
          { AttributeName: "pk", KeyType: "HASH" },
          { AttributeName: "sk", KeyType: "RANGE" },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: "EmailIndex",
            KeySchema: [{ AttributeName: "email", KeyType: "HASH" }],
            Projection: { ProjectionType: "ALL" },
          },
        ],
      })
    );
    for (let attempt = 0; attempt < 30; attempt++) {
      const { Table } = await dynamo.send(
        new DescribeTableCommand({ TableName })
      );
      if (Table?.TableStatus === "ACTIVE") return;
      await sleep(500);
    }
    throw new Error("table never became ACTIVE");
  });

  await check(group, "UpdateTimeToLive", async () => {
    await dynamo.send(
      new UpdateTimeToLiveCommand({
        TableName,
        TimeToLiveSpecification: { AttributeName: "ttl", Enabled: true },
      })
    );
  });

  await check(group, "PutItem / GetItem", async () => {
    await docs.send(
      new PutCommand({
        TableName,
        Item: { pk: "a", sk: "1", email: "a@example.com", count: 1 },
      })
    );
    const { Item } = await docs.send(
      new GetCommand({ TableName, Key: { pk: "a", sk: "1" } })
    );
    expect(Item?.email === "a@example.com", "item did not round-trip");
  });

  await check(group, "Query on a GSI", async () => {
    const { Items } = await docs.send(
      new QueryCommand({
        TableName,
        IndexName: "EmailIndex",
        KeyConditionExpression: "email = :e",
        ExpressionAttributeValues: { ":e": "a@example.com" },
      })
    );
    expect(Items?.length === 1, `expected 1 item, got ${Items?.length}`);
  });

  await check(group, "UpdateItem with a condition", async () => {
    await docs.send(
      new UpdateCommand({
        TableName,
        Key: { pk: "a", sk: "1" },
        UpdateExpression: "SET #c = #c + :one",
        ConditionExpression: "attribute_exists(pk)",
        ExpressionAttributeNames: { "#c": "count" },
        ExpressionAttributeValues: { ":one": 1 },
      })
    );
    let rejected = false;
    try {
      await docs.send(
        new UpdateCommand({
          TableName,
          Key: { pk: "missing", sk: "1" },
          UpdateExpression: "SET #c = :one",
          ConditionExpression: "attribute_exists(pk)",
          ExpressionAttributeNames: { "#c": "count" },
          ExpressionAttributeValues: { ":one": 1 },
        })
      );
    } catch (error) {
      rejected = (error as Error).name === "ConditionalCheckFailedException";
    }
    expect(rejected, "a failing condition was not rejected");
  });

  await check(group, "TransactWriteItems (Put + Delete)", async () => {
    await docs.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName,
              Item: { pk: "b", sk: "1", email: "b@example.com" },
            },
          },
          { Delete: { TableName, Key: { pk: "a", sk: "1" } } },
        ],
      })
    );
    const { Item } = await docs.send(
      new GetCommand({ TableName, Key: { pk: "b", sk: "1" } })
    );
    expect(Item, "transaction did not write the Put");
  });

  await dynamo
    .send(new DeleteTableCommand({ TableName }))
    .catch(() => undefined);
};

const smokeSqs = async (): Promise<void> => {
  const group = "sqs";
  let QueueUrl = "";

  await check(group, "CreateQueue", async () => {
    const response = await sqs.send(
      new CreateQueueCommand({ QueueName: `${run}-queue` })
    );
    QueueUrl = response.QueueUrl ?? "";
    expect(QueueUrl, "no queue URL returned");
    expect(
      QueueUrl.includes(ACCOUNT_ID),
      `queue URL ${QueueUrl} is not in account ${ACCOUNT_ID}`
    );
  });
  if (!QueueUrl) return;

  await check(group, "SendMessage", async () => {
    await sqs.send(new SendMessageCommand({ QueueUrl, MessageBody: "one" }));
  });
  await check(group, "SendMessageBatch", async () => {
    await sqs.send(
      new SendMessageBatchCommand({
        QueueUrl,
        Entries: [
          { Id: "1", MessageBody: "two" },
          { Id: "2", MessageBody: "three" },
        ],
      })
    );
  });
  await check(group, "ReceiveMessage / DeleteMessage", async () => {
    const bodies: string[] = [];
    for (let attempt = 0; attempt < 5 && bodies.length < 3; attempt++) {
      const { Messages = [] } = await sqs.send(
        new ReceiveMessageCommand({
          QueueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 1,
        })
      );
      for (const message of Messages) {
        bodies.push(message.Body ?? "");
        await sqs.send(
          new DeleteMessageCommand({
            QueueUrl,
            ReceiptHandle: message.ReceiptHandle,
          })
        );
      }
    }
    expect(bodies.length === 3, `received ${bodies.length} of 3 messages`);
  });

  await sqs.send(new DeleteQueueCommand({ QueueUrl })).catch(() => undefined);
};

const smokeSns = async (): Promise<void> => {
  let TopicArn = "";
  await check("sns", "CreateTopic", async () => {
    const response = await sns.send(
      new CreateTopicCommand({ Name: `${run}-topic` })
    );
    TopicArn = response.TopicArn ?? "";
    expect(TopicArn, "no topic ARN returned");
  });
  if (!TopicArn) return;
  await check("sns", "Publish", async () => {
    await sns.send(new PublishCommand({ TopicArn, Message: "hello" }));
  });
  await sns.send(new DeleteTopicCommand({ TopicArn })).catch(() => undefined);
};

const smokeKms = async (): Promise<void> => {
  const group = "kms";
  let KeyId = "";
  await check(group, "CreateKey", async () => {
    const { KeyMetadata } = await kms.send(
      new CreateKeyCommand({ Description: run })
    );
    KeyId = KeyMetadata?.Arn ?? "";
    expect(KeyId, "no key ARN returned");
    expect(
      KeyId.includes(`:${ACCOUNT_ID}:`),
      `key ${KeyId} is not in account ${ACCOUNT_ID}`
    );
  });
  if (!KeyId) return;
  await check(group, "GenerateDataKey / Decrypt (with context)", async () => {
    const EncryptionContext = { purpose: "smoke" };
    const generated = await kms.send(
      new GenerateDataKeyCommand({
        KeyId,
        KeySpec: "AES_256",
        EncryptionContext,
      })
    );
    expect(generated.CiphertextBlob, "no ciphertext returned");
    const decrypted = await kms.send(
      new DecryptCommand({
        KeyId,
        CiphertextBlob: generated.CiphertextBlob,
        EncryptionContext,
      })
    );
    expect(
      Buffer.from(decrypted.Plaintext ?? []).equals(
        Buffer.from(generated.Plaintext ?? [])
      ),
      "decrypted data key differs"
    );
  });
  await kms
    .send(new ScheduleKeyDeletionCommand({ KeyId, PendingWindowInDays: 7 }))
    .catch(() => undefined);
};

const smokeSecrets = async (): Promise<void> => {
  const Name = `${run}-secret`;
  await check("secretsmanager", "CreateSecret / GetSecretValue", async () => {
    await secrets.send(
      new CreateSecretCommand({ Name, SecretString: "s3cret" })
    );
    const { SecretString } = await secrets.send(
      new GetSecretValueCommand({ SecretId: Name })
    );
    expect(SecretString === "s3cret", "secret did not round-trip");
  });
  await secrets
    .send(
      new DeleteSecretCommand({
        SecretId: Name,
        ForceDeleteWithoutRecovery: true,
      })
    )
    .catch(() => undefined);
};

const printResults = (): void => {
  const width = Math.max(...results.map((r) => r.check.length));
  let group = "";
  for (const result of results) {
    if (result.group !== group) {
      group = result.group;
      console.log(`\n${group}`);
    }
    const mark = result.skipped ? "SKIP" : result.ok ? "PASS" : "FAIL";
    console.log(
      `  ${mark}  ${result.check.padEnd(width)}${result.detail ? `  ${result.detail}` : ""}`
    );
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
};

const main = async (): Promise<number> => {
  assertEmulatorEnvironment();
  console.log(`Smoke test against ${process.env.AWS_ENDPOINT_URL} (${run})`);
  await smokeDynamo();
  await smokeSqs();
  await smokeSns();
  await smokeKms();
  await smokeSecrets();
  printResults();
  return results.some((r) => !r.ok) ? 1 : 0;
};

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
);
