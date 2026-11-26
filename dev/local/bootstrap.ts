// Creates the DynamoDB tables, SQS queues and KMS keys that the Lambdas need in
// the local AWS Emulator. Safe to run repeatedly. The emulator keeps its state
// in memory only, so run this after every `npm run local:up`.
//
// Tables and queues are read from template.yaml so they can't drift from it.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ResourceInUseException,
  UpdateTableCommand,
  UpdateTimeToLiveCommand,
  type CreateTableCommandInput,
  type StreamViewType,
  type TableDescription,
} from "@aws-sdk/client-dynamodb";
import { CreateQueueCommand, SQSClient } from "@aws-sdk/client-sqs";
import {
  CreateKeyCommand,
  DescribeKeyCommand,
  KMSClient,
} from "@aws-sdk/client-kms";
import { ACCOUNT_ID, RESOURCES_FILE, type LocalResources } from "./config.ts";
import { assertEmulatorEnvironment } from "./runtime.ts";
import { loadTemplate, type TemplateTable } from "./template.ts";

const dynamo = new DynamoDBClient({});
const sqs = new SQSClient({});
const kms = new KMSClient({});

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

export const tableInput = (table: TemplateTable): CreateTableCommandInput => ({
  TableName: table.tableName,
  BillingMode: "PAY_PER_REQUEST",
  AttributeDefinitions: table.attributeDefinitions.map((attribute) => ({
    AttributeName: attribute.AttributeName,
    AttributeType: attribute.AttributeType as "S" | "N" | "B",
  })),
  KeySchema: table.keySchema.map((key) => ({
    AttributeName: key.AttributeName,
    KeyType: key.KeyType as "HASH" | "RANGE",
  })),
  ...(table.streamViewType && {
    StreamSpecification: {
      StreamEnabled: true,
      StreamViewType: table.streamViewType as StreamViewType,
    },
  }),
  ...(table.globalSecondaryIndexes.length > 0 && {
    GlobalSecondaryIndexes: table.globalSecondaryIndexes.map((index) => ({
      IndexName: index.indexName,
      KeySchema: index.keySchema.map((key) => ({
        AttributeName: key.AttributeName,
        KeyType: key.KeyType as "HASH" | "RANGE",
      })),
      Projection: { ProjectionType: "ALL" as const },
    })),
  }),
});

const waitUntilActive = async (
  tableName: string
): Promise<TableDescription> => {
  // Same as AWS: a table is usable once DescribeTable says ACTIVE.
  for (let attempt = 0; attempt < 30; attempt++) {
    const { Table } = await dynamo.send(
      new DescribeTableCommand({ TableName: tableName })
    );
    if (Table?.TableStatus === "ACTIVE") return Table;
    await sleep(500);
  }
  throw new Error(`Table ${tableName} did not become ACTIVE`);
};

const createTable = async (table: TemplateTable): Promise<void> => {
  let created = true;
  try {
    await dynamo.send(new CreateTableCommand(tableInput(table)));
  } catch (error) {
    if (!(error instanceof ResourceInUseException)) throw error;
    created = false;
  }
  const description = await waitUntilActive(table.tableName);

  // A table created by an earlier bootstrap may predate stream support.
  if (!created && table.streamViewType && !description.LatestStreamArn) {
    await dynamo.send(
      new UpdateTableCommand({
        TableName: table.tableName,
        StreamSpecification: {
          StreamEnabled: true,
          StreamViewType: table.streamViewType as StreamViewType,
        },
      })
    );
    await waitUntilActive(table.tableName);
  }

  if (created && table.ttlAttribute) {
    try {
      await dynamo.send(
        new UpdateTimeToLiveCommand({
          TableName: table.tableName,
          TimeToLiveSpecification: {
            AttributeName: table.ttlAttribute,
            Enabled: true,
          },
        })
      );
    } catch (error) {
      // Not fatal: TTL only matters for expiry, which doesn't affect a
      // short local session.
      console.warn(
        `  warning: could not enable TTL on ${table.tableName}: ${(error as Error).name}`
      );
    }
  }
  console.log(
    `  table  ${table.tableName}${created ? "" : " (already exists)"}`
  );
};

const createQueue = async (logicalId: string): Promise<string> => {
  const { QueueUrl } = await sqs.send(
    new CreateQueueCommand({ QueueName: logicalId })
  );
  if (!QueueUrl) throw new Error(`No URL returned for queue ${logicalId}`);
  return QueueUrl;
};

const keyStillExists = async (arn: string | undefined): Promise<boolean> => {
  if (!arn) return false;
  try {
    await kms.send(new DescribeKeyCommand({ KeyId: arn }));
    return true;
  } catch {
    return false;
  }
};

const ensureKey = async (
  description: string,
  existing: string | undefined
): Promise<string> => {
  if (await keyStillExists(existing)) return existing as string;
  const { KeyMetadata } = await kms.send(
    new CreateKeyCommand({ Description: description })
  );
  if (!KeyMetadata?.Arn)
    throw new Error(`No ARN returned for key ${description}`);
  return KeyMetadata.Arn;
};

const readPreviousResources = (): LocalResources | undefined => {
  try {
    return JSON.parse(readFileSync(RESOURCES_FILE, "utf8")) as LocalResources;
  } catch {
    return undefined;
  }
};

const main = async (): Promise<void> => {
  assertEmulatorEnvironment();
  const template = loadTemplate();

  console.log("Creating tables...");
  for (const table of template.tables) {
    // Sequential: a handful of tables, and it keeps the output readable.
    await createTable(table);
  }

  console.log("Creating queues...");
  const queueUrls: Record<string, string> = {};
  for (const logicalId of template.queueLogicalIds) {
    queueUrls[logicalId] = await createQueue(logicalId);
  }
  console.log(`  ${template.queueLogicalIds.length} queues`);

  console.log("Creating KMS keys...");
  const previous = readPreviousResources();
  const keyArns = {
    generator: await ensureKey(
      "local generator key",
      previous?.keyArns.generator
    ),
    wrapper: await ensureKey("local wrapping key", previous?.keyArns.wrapper),
    backupWrapper: await ensureKey(
      "local backup wrapping key",
      previous?.keyArns.backupWrapper
    ),
  };

  for (const arn of Object.values(keyArns)) {
    if (!arn.includes(`:${ACCOUNT_ID}:`)) {
      throw new Error(
        `Key ${arn} is not in account ${ACCOUNT_ID}. This is not the emulator: stopping.`
      );
    }
  }

  const resources: LocalResources = { queueUrls, keyArns };
  mkdirSync(dirname(RESOURCES_FILE), { recursive: true });
  writeFileSync(RESOURCES_FILE, `${JSON.stringify(resources, null, 2)}\n`);
  console.log(`Done. Wrote ${RESOURCES_FILE}`);
};

// Only run when executed directly, so tests can import tableInput.
if (process.argv[1]?.endsWith("bootstrap.ts")) {
  main().then(
    () => process.exit(0),
    (error: unknown) => {
      console.error(
        error instanceof Error ? (error.stack ?? error.message) : error
      );
      process.exit(1);
    }
  );
}
