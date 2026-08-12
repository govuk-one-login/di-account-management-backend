import { Context, SQSEvent } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { MetricUnit } from "@aws-lambda-powertools/metrics";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import assert from "node:assert/strict";
import { initMetrics } from "./common/metrics.js";
import { processConfig } from "./common/process-config.js";
import { getEnvironmentVariable } from "./common/utils.js";
import { getAisStatus } from "./common/account-interventions-service-client.js";

const logger = new Logger();
const metrics = initMetrics("process-inactive-account");
const sqsClient = new SQSClient();
const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(dynamoClient);

export const handler = async (
  event: SQSEvent,
  context: Context
): Promise<void> => {
  logger.addContext(context);

  const notificationQueueUrl = getEnvironmentVariable("NOTIFICATION_QUEUE_URL");
  const tableName = getEnvironmentVariable("INACTIVE_ACCOUNT_TRACKER_TABLE_NAME");

  for (const record of event.Records) {
    const body = JSON.parse(record.body);
    const process = processConfig[body.processName];

    logger.info("Processing inactive account warning", {
      commonSubjectId: body.commonSubjectId,
      processName: body.processName,
    });

    const aisStatus = await getAisStatus(body.commonSubjectId);
    if (aisStatus.state.blocked) {
      logger.info("User is blocked, skipping processing", {
        commonSubjectId: body.commonSubjectId,
        processName: body.processName,
      });
      continue;
    }

    assert(process, `Process configuration not found for ${body.processName}`);

    if (!process.allowedStatuses.includes(body.status)) {
      logger.info(`Status ${body.status} is not allowed for process ${body.processName}`);
      continue;
    }

    assert(
      process.targetStatus,
      `No target status configured for process ${body.processName}`
    );

    if (process.notificationType) {
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
    } else {
      logger.info("No notificationType configured, skipping notification", {
        commonSubjectId: body.commonSubjectId,
        processName: body.processName,
      });
    }

    await dynamoDocClient.send(
      new UpdateCommand({
        TableName: tableName,
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

    if (process.targetQueueUrlEnvVar) {
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

    logger.info("Successfully processed inactive account", {
      commonSubjectId: body.commonSubjectId,
      processName: body.processName,
      targetStatus: process.targetStatus,
    });
  }

  metrics.publishStoredMetrics();
};
