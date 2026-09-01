import { Context, SQSEvent } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { MetricUnit } from "@aws-lambda-powertools/metrics";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import assert from "node:assert/strict";
import { initMetrics } from "./common/metrics.js";
import { processConfig, ProcessConfig, Actions } from "./common/process-config.js";
import type { InactiveAccountStatus } from "./common/model.js";
import { getEnvironmentVariable } from "./common/utils.js";
import { sendAuditEvent } from "./common/send-audit-event.js";

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
    const guardResult = await guard.guard(body.commonSubjectId);
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
