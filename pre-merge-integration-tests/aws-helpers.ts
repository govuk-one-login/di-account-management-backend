// AWS integration helpers for the integration suite. These exercise real
// deployed AWS infrastructure when run via the integration config; the unit
// tests mock the clients instead.

import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

import { AWS_REGION, getQueueUrl, MissingConfigError } from "./config.js";

const sqsClient = new SQSClient({ region: AWS_REGION });
const dynamoDbClient = new DynamoDBClient({ region: AWS_REGION });
export const documentClient = DynamoDBDocumentClient.from(dynamoDbClient);
const secretsManagerClient = new SecretsManagerClient({
  region: AWS_REGION,
});

// Object payloads are JSON-serialised; string payloads pass through unchanged.
// Returns the SQS MessageId on success.
export async function sendMessage(
  payload: Record<string, unknown> | string
): Promise<string> {
  const queueUrl = getQueueUrl();
  if (queueUrl === undefined || queueUrl.length === 0) {
    throw new MissingConfigError("SQS_QUEUE_ARN");
  }

  const messageBody =
    typeof payload === "string" ? payload : JSON.stringify(payload);

  const response = await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: messageBody,
    })
  );

  return response.MessageId as string;
}

// Retrieves the secret string for `secretId` within 10s. Throws on an empty id,
// a retrieval error, or an empty secret string.
export async function getSecret(secretId: string): Promise<string> {
  if (secretId.length === 0) {
    throw new Error(
      "Could not retrieve secret: an empty secret identifier was supplied"
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  let response;
  try {
    response = await secretsManagerClient.send(
      new GetSecretValueCommand({ SecretId: secretId }),
      { abortSignal: controller.signal }
    );
  } finally {
    clearTimeout(timer);
  }

  const secretString = response.SecretString;
  if (secretString === undefined || secretString.length === 0) {
    throw new Error(
      `Secret value for "${secretId}" was empty and could not be used`
    );
  }

  return secretString;
}

export interface MatchCriteria {
  keyConditionExpression: string;
  expressionAttributeNames: Record<string, string>;
  expressionAttributeValues: Record<string, unknown>;
}

export interface PollOptions {
  indexName?: string;
  timeoutSeconds?: number;
  description?: string;
}

// Polls the table (or `indexName`) with a 1s delay between attempts until a
// matching item is found or the timeout (default 30s) elapses, returning the
// first match. Per-attempt query errors are swallowed and polling continues. On
// timeout with no match, throws an assertion failure naming the table, index,
// criteria, and timeout.
export async function pollForItem(
  tableName: string,
  criteria: MatchCriteria,
  options?: PollOptions
): Promise<Record<string, unknown>> {
  const timeoutSeconds = options?.timeoutSeconds ?? 30;
  const indexName = options?.indexName;

  const deadline = Date.now() + timeoutSeconds * 1000;
  let allAttemptsErrored = true;

  for (;;) {
    try {
      const response = await documentClient.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: indexName,
          KeyConditionExpression: criteria.keyConditionExpression,
          ExpressionAttributeNames: criteria.expressionAttributeNames,
          ExpressionAttributeValues: criteria.expressionAttributeValues,
        })
      );

      allAttemptsErrored = false;

      const items = response.Items;
      if (items !== undefined && items.length > 0) {
        return items[0] as Record<string, unknown>;
      }
    } catch {
      // Swallow per-attempt query errors and keep polling.
    }

    // The 1s delay must not push us past the deadline.
    if (Date.now() + 1000 >= deadline) {
      break;
    }

    // Intentional sequential pause between poll attempts; the loop must wait
    // before re-querying. Parallelising this would defeat the purpose.
    await new Promise((resolve) => setTimeout(resolve, 1000)); // NOSONAR: await-in-loop is deliberate here.
  }

  const indexClause = indexName !== undefined ? ` (index "${indexName}")` : "";
  const descriptionClause =
    options?.description !== undefined ? ` for ${options.description}` : "";
  const criteriaDescription = JSON.stringify({
    keyConditionExpression: criteria.keyConditionExpression,
    expressionAttributeNames: criteria.expressionAttributeNames,
    expressionAttributeValues: criteria.expressionAttributeValues,
  });
  const errorsClause = allAttemptsErrored
    ? " Every query attempt returned a DynamoDB error during polling."
    : "";

  throw new Error(
    `No item was found in table "${tableName}"${indexClause}${descriptionClause} ` +
      `matching criteria ${criteriaDescription} within ${timeoutSeconds}s.${errorsClause}`
  );
}

export interface AbsenceOptions {
  indexName?: string;
  delaySeconds?: number;
  description?: string;
}

// Waits a fixed delay (default 10s), then issues a single query (aborted after
// 30s). Returns when zero items match; throws naming the match count when one or
// more do. Query errors propagate.
export async function assertNoItem(
  tableName: string,
  criteria: MatchCriteria,
  options?: AbsenceOptions
): Promise<void> {
  const delaySeconds = options?.delaySeconds ?? 10;
  const indexName = options?.indexName;

  const indexClause = indexName !== undefined ? ` (index "${indexName}")` : "";
  const descriptionClause =
    options?.description !== undefined ? ` for ${options.description}` : "";

  await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  let response;
  try {
    response = await documentClient.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: indexName,
        KeyConditionExpression: criteria.keyConditionExpression,
        ExpressionAttributeNames: criteria.expressionAttributeNames,
        ExpressionAttributeValues: criteria.expressionAttributeValues,
      }),
      { abortSignal: controller.signal }
    );
  } catch (error) {
    // Distinguish a 30s timeout (aborted) from any other query error.
    if (controller.signal.aborted) {
      throw new Error(
        `Absence query against table "${tableName}"${indexClause}${descriptionClause} ` +
          `did not return within 30s and was aborted.`,
        { cause: error }
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  const items = response.Items ?? [];
  const matchCount = items.length;

  if (matchCount === 0) {
    return;
  }

  throw new Error(
    `Expected no item in table "${tableName}"${indexClause}${descriptionClause}, ` +
      `but found ${matchCount} matching item${matchCount === 1 ? "" : "s"}.`
  );
}

export type PrimaryKey = Record<string, unknown>;

// Deletes the item identified by `key` within 30s. On any error (including the
// timeout) logs a warning and returns without throwing, so cleanup never fails
// the calling test.
export async function deleteItem(
  tableName: string,
  key: PrimaryKey
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    await documentClient.send(
      new DeleteCommand({
        TableName: tableName,
        Key: key as Record<string, unknown>,
      }),
      { abortSignal: controller.signal }
    );
  } catch (error) {
    console.warn(
      `Failed to delete item from table "${tableName}" with key ` +
        `${JSON.stringify(key)}: ${String(error)}`
    );
  } finally {
    clearTimeout(timer);
  }
}
