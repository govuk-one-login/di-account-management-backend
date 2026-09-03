import { Context, SQSEvent } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { MetricUnit } from "@aws-lambda-powertools/metrics";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  UpdateCommand,
  QueryCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import assert from "node:assert/strict";
import { initMetrics } from "./common/metrics.js";
import { processConfig, ProcessConfig, Actions } from "./common/process-config.js";
import type { InactiveAccountStatus, InactiveAccountTrackerRecord } from "./common/model.js";
import { getEnvironmentVariable } from "./common/utils.js";
import { sendAuditEvent } from "./common/send-audit-event.js";
import { mergeTrackerRecords } from "./common/merge-tracker-records.js";

const logger = new Logger();
const metrics = initMetrics("process-inactive-account");
const sqsClient = new SQSClient();
const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(dynamoClient);


async function runGuards(
  guards: ProcessConfig[number]["guards"],
  body: Record<string, string>
): Promise<Actions> {
  if (!guards) return Actions.continue;

  for (const guard of guards) {
    const guardResult = await guard.guard(body.commonSubjectId, body.emailAddress);
    const typeOfGuardResult = guardResult.continue;

    if (typeOfGuardResult === Actions.continueWithoutActions || typeOfGuardResult === Actions.abort) {
      const message = typeOfGuardResult === Actions.abort ? "GuardrailAbortedInactiveAccountDeletionProcess" : "GuardrailInactiveAccountDeletionProcessContinuedWithoutActions";
      logger.info(message, {
        dateForDeletion: body.dateForDeletion,
        processName: body.processName,
        status: body.status,
        statusLastUpdated: body.statusLastUpdated,
        userLastActive: body.userLastActive,
        userLastActiveSource: body.userLastActiveSource,
        userLastActiveSourceId: body.userLastActiveSourceId,
        userLastActiveUpdated: body.userLastActiveUpdated,
        emailAddressLastUpdated: body.emailAddressLastUpdated,
        emailAddressSource: body.emailAddressSource,
        emailAddressSourceId: body.emailAddressSourceId,
        hasSetupMfa: body.hasSetupMfa,
        guard: guardResult.guardName,
        contributeToAlarm: guard.contributeToAlarm,
      });

      return guardResult.continue;
    }
  }
  return Actions.continue;
}

type ProcessDefinition = ProcessConfig[string];

async function enqueueNotification(
  process: ProcessDefinition,
  body: Record<string, string>,
  notificationQueueUrl: string
): Promise<void> {
  if (!process.notificationType) return;

  const message = {
    notificationType: process.notificationType,
    emailAddress: body.emailAddress,
    dateForDeletion: body.dateForDeletion,
  };

  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: notificationQueueUrl,
      MessageBody: JSON.stringify(message),
    })
  );

  logger.info("Successfully enqueued inactive account warning notification", {
    commonSubjectId: body.commonSubjectId,
    processName: body.processName,
    notificationType: process.notificationType,
  });
  metrics.addMetric("notificationEnqueued", MetricUnit.Count, 1);
}

async function enqueueTargetMessage(
  process: ProcessDefinition,
  body: Record<string, string>
): Promise<void> {
  if (!process.targetQueueUrlEnvVar) return;

  const targetQueueUrl = getEnvironmentVariable(process.targetQueueUrlEnvVar);
  const targetMessage = {
    publicSubjectId: body.publicSubjectId,
    commonSubjectId: body.commonSubjectId,
  };

  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: targetQueueUrl,
      MessageBody: JSON.stringify(targetMessage),
    })
  );

  logger.info("Successfully enqueued message to target queue", {
    commonSubjectId: body.commonSubjectId,
    processName: body.processName,
    targetQueueUrlEnvVar: process.targetQueueUrlEnvVar,
  });
}

async function updateTrackerStatus(
  process: ProcessDefinition,
  body: Record<string, string>,
  inactiveAccountTrackerTableName: string
): Promise<void> {
  await dynamoDocClient.send(
    new UpdateCommand({
      TableName: inactiveAccountTrackerTableName,
      Key: {
        dateForDeletion: body.dateForDeletion,
        commonSubjectId: body.commonSubjectId,
      },
      UpdateExpression: "SET #status = :status, statusLastUpdated = :timestamp",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":status": process.targetStatus,
        ":timestamp": new Date().toISOString(),
      },
    })
  );
}

async function emitAuditEvent(
  process: ProcessDefinition,
  body: Record<string, string>
): Promise<void> {
  if (!process.auditEventName) return;

  await sendAuditEvent(process.auditEventName, {
    user: {
      user_id: body.commonSubjectId,
    },
    extensions: {
      accountTrackerAccountDeletionDate: body.dateForDeletion,
    },
  });
}

// A race condition can leave multiple tracker rows for the same user. Before processing an
// account we collapse any duplicates into a single, most-up-to-date record so that we act on
// correct data (e.g. the latest status/dateForDeletion) and never process a stale duplicate.
// The merged record is written to the surviving row and the stale duplicate rows are deleted
// in a single transaction. The returned record's fields are overlaid onto the message body so
// the rest of processing (status update, notifications, target dispatch) uses the merged data.
async function mergeDuplicatesBeforeProcessing(
  body: Record<string, string>,
  inactiveAccountTrackerTableName: string
): Promise<void> {
  const userId = body.commonSubjectId;

  const response = await dynamoDocClient.send(
    new QueryCommand({
      TableName: inactiveAccountTrackerTableName,
      IndexName: "CommonSubjectIdIndex",
      KeyConditionExpression: "commonSubjectId = :id",
      ExpressionAttributeValues: { ":id": userId },
    })
  );

  const allRows = (response.Items ?? []) as InactiveAccountTrackerRecord[];

  // Nothing to merge: 0 rows (fall back to the body as dispatched) or a single row.
  if (allRows.length <= 1) return;

  logger.warn("MERGING_DUPLICATE_INACTIVE_ACCOUNT_TRACKER_RECORDS", {
    commonSubjectId: userId,
    duplicateCount: allRows.length,
  });

  const merged = mergeTrackerRecords(allRows);

  // Delete every stale duplicate row whose dateForDeletion differs from the merged record's,
  // then write the merged record to the surviving row, all in a single transaction so the
  // table is never left with a partial merge.
  const staleDeletionDates = [
    ...new Set(
      allRows
        .map((row) => row.dateForDeletion)
        .filter((dateForDeletion) => dateForDeletion !== merged.dateForDeletion)
    ),
  ];

  const transactItems: ConstructorParameters<typeof TransactWriteCommand>[0]["TransactItems"] = [
    { Put: { TableName: inactiveAccountTrackerTableName, Item: merged as unknown as Record<string, unknown> } },
    ...staleDeletionDates.map((dateForDeletion) => ({
      Delete: {
        TableName: inactiveAccountTrackerTableName,
        Key: { dateForDeletion, commonSubjectId: userId },
      },
    })),
  ];

  await dynamoDocClient.send(new TransactWriteCommand({ TransactItems: transactItems }));

  // Overlay the merged record onto the message body so downstream processing (status update
  // keyed on dateForDeletion, notifications, target dispatch) acts on the merged data.
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined) continue;
    body[key] = typeof value === "string" ? value : String(value);
  }
}

async function processRecord(
  body: Record<string, string>,
  notificationQueueUrl: string,
  inactiveAccountTrackerTableName: string
): Promise<void> {
  const process = processConfig[body.processName];

  logger.info("Processing inactive account warning", {
    commonSubjectId: body.commonSubjectId,
    processName: body.processName,
  });

  assert(process, `Process configuration not found for ${body.processName}`);

  await mergeDuplicatesBeforeProcessing(body, inactiveAccountTrackerTableName);

  if (!process.allowedStatuses.includes(body.status as InactiveAccountStatus)) {
    logger.info(
      `Status ${body.status} is not allowed for process ${body.processName}`
    );
    return;
  }

  assert(
    process.targetStatus,
    `No target status configured for process ${body.processName}`
  );

  const runGuardsOutcome = await runGuards(process.guards, body);

  if (runGuardsOutcome === Actions.abort) return;

  if (runGuardsOutcome === Actions.continue) {
    await enqueueNotification(process, body, notificationQueueUrl);
    await enqueueTargetMessage(process, body);
  }

  await updateTrackerStatus(process, body, inactiveAccountTrackerTableName);
  await emitAuditEvent(process, body);

  logger.info("Successfully processed inactive account", {
    commonSubjectId: body.commonSubjectId,
    processName: body.processName,
    targetStatus: process.targetStatus,
  });
}

export const handler = async (
  event: SQSEvent,
  context: Context
): Promise<void> => {
  logger.addContext(context);

  const notificationQueueUrl = getEnvironmentVariable("NOTIFICATION_QUEUE_URL");
  const inactiveAccountTrackerTableName = getEnvironmentVariable(
    "INACTIVE_ACCOUNT_TRACKER_TABLE_NAME"
  );

  for (const record of event.Records) {
    const body = JSON.parse(record.body);
    await processRecord(
      body,
      notificationQueueUrl,
      inactiveAccountTrackerTableName
    );
  }

  metrics.publishStoredMetrics();
};
