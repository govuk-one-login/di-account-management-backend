import { Context, SQSEvent } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { MetricUnit } from "@aws-lambda-powertools/metrics";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import assert from "node:assert/strict";
import { initMetrics } from "./common/metrics.js";
import { processConfig } from "./common/process-config.js";
import { getEnvironmentVariable } from "./common/utils.js";

const logger = new Logger();
const metrics = initMetrics("send-inactive-warning-email");
const sqsClient = new SQSClient();

export const handler = async (
  event: SQSEvent,
  context: Context
): Promise<void> => {
  logger.addContext(context);

  const notificationQueueUrl = getEnvironmentVariable("NOTIFICATION_QUEUE_URL");

  for (const record of event.Records) {
    const body = JSON.parse(record.body);
    const process = processConfig[body.processName];

    logger.info("Processing inactive account warning", {
      commonSubjectId: body.commonSubjectId,
      processName: body.processName,
    });

    assert(process, `Process configuration not found for ${body.processName}`);

    if (!process.allowedStatuses.includes(body.status)) {
      logger.info(`Status ${body.status} is not allowed for process ${body.processName}`);
      continue;
    }

    assert(
      process.notificationType,
      `No notification type configured for process ${body.processName}`
    );

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

  metrics.publishStoredMetrics();
};
