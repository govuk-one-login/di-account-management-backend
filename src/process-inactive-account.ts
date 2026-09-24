import { Context, SQSEvent } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { MetricUnit } from "@aws-lambda-powertools/metrics";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import assert from "node:assert/strict";
import { initMetrics } from "./common/metrics.js";
import { processConfig, ProcessConfig } from "./common/process-config.js";
import type {
  InactiveAccountStatus,
  InactiveAccountTrackerRecord,
} from "./common/model.js";

type ProcessInactiveAccountMessage = InactiveAccountTrackerRecord & {
  processName: string;
  isDryRun: boolean;
  manualTest?: boolean;
};

import { getEnvironmentVariable } from "./common/utils.js";
import { sendAuditEvent } from "./common/send-audit-event.js";
import { mergeTrackerRecords } from "./common/merge-tracker-records.js";
import { getIadCircuitBreakerStatus } from "./common/iad-circuit-breaker.js";

const logger = new Logger();
const metrics = initMetrics("process-inactive-account");
const sqsClient = new SQSClient();
const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(dynamoClient);

enum GuardsOutcome {
  continue = "continue",
  continueWithoutActions = "continueWithoutActions",
  abort = "abort",
}

async function runSubsetOfGuards(
  guards: NonNullable<ProcessConfig[number]["guards"]>[keyof NonNullable<
    ProcessConfig[number]["guards"]
  >],
  logMessage: string,
  body: ProcessInactiveAccountMessage
): Promise<{ guardActivated: boolean }> {
  for (const guard of guards ?? []) {
    const guardResult = await guard.guard(body);

    if (guardResult.guardActivated) {
      logger.info(logMessage, {
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
        guardrailType: guardResult.guardName,
        contributeToAlarm: guard.contributeToAlarm ? "1" : "0",
        continueProcessingRecords: "1",
      });

      if (guard.skippedNotificationAuditEventName) {
        await sendAuditEvent(guard.skippedNotificationAuditEventName, {
          user: {
            user_id: body.commonSubjectId,
          },
          extensions: {
            accountTrackerNotificationSkipReason:
              guard.skippedNotificationAuditEventReason ?? "",
          },
        });
      }

      return { guardActivated: true };
    }
  }

  return { guardActivated: false };
}

async function runGuards(
  guards: ProcessConfig[number]["guards"],
  body: ProcessInactiveAccountMessage
): Promise<GuardsOutcome> {
  const abortGuardsResult = await runSubsetOfGuards(
    guards?.abort,
    "GuardrailAbortedInactiveAccountDeletionProcess",
    body
  );

  if (abortGuardsResult.guardActivated) return GuardsOutcome.abort;

  const continueWithoutActionsGuardsResult = await runSubsetOfGuards(
    guards?.continueWithoutActions,
    "GuardrailInactiveAccountDeletionProcessContinuedWithoutActions",
    body
  );

  if (continueWithoutActionsGuardsResult.guardActivated)
    return GuardsOutcome.continueWithoutActions;

  return GuardsOutcome.continue;
}

type ProcessDefinition = ProcessConfig[string];

async function enqueueNotification(
  process: ProcessDefinition,
  body: ProcessInactiveAccountMessage,
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
  body: ProcessInactiveAccountMessage
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
  body: ProcessInactiveAccountMessage,
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
  body: ProcessInactiveAccountMessage
): Promise<void> {
  if (!process.auditEventName) return;

  await sendAuditEvent(process.auditEventName, {
    user: {
      user_id: body.commonSubjectId,
      ...(process.sendAdditionalAuditEventDetails && {
        email: body.emailAddress,
        public_subject_id: body.publicSubjectId,
      }),
    },
    extensions: {
      accountTrackerAccountDeletionDate: body.dateForDeletion,
      ...(process.sendAdditionalAuditEventDetails && {
        accountTrackerAccountLastAccessDate: body.userLastActive,
        accountTrackerAccountLastAccessSource: body.userLastActiveSource,
        accountTrackerAccountLastAccessSourceEventId:
          body.userLastActiveSourceId,
      }),
    },
  });
}

async function processRecord(
  body: ProcessInactiveAccountMessage,
  notificationQueueUrl: string,
  inactiveAccountTrackerTableName: string
): Promise<void> {
  const process = processConfig[body.processName];

  logger.info("Processing inactive account record", {
    commonSubjectId: body.commonSubjectId,
    processName: body.processName,
  });

  assert(process, `Process configuration not found for ${body.processName}`);

  const merged = await mergeTrackerRecords(
    body.commonSubjectId,
    dynamoDocClient,
    inactiveAccountTrackerTableName
  );

  if (merged) {
    const defined = Object.fromEntries(
      Object.entries(merged).filter(([, v]) => v !== undefined)
    );
    Object.assign(body, defined);
  }

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

  if (runGuardsOutcome === GuardsOutcome.abort) return;

  if (runGuardsOutcome === GuardsOutcome.continue) {
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
    const body = JSON.parse(record.body) as ProcessInactiveAccountMessage;

    const iadCircuitBreakerActive = await getIadCircuitBreakerStatus();

    if (iadCircuitBreakerActive) {
      logger.info("GuardrailAbortedProcessInactiveAccounts", {
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
        guardrailType: "CircuitBreakerAlreadyTripped",
        contributeToAlarm: "1",
        continueProcessingRecords: "0",
      });
      return;
    }

    await processRecord(
      body,
      notificationQueueUrl,
      inactiveAccountTrackerTableName
    );
  }

  metrics.publishStoredMetrics();
};
