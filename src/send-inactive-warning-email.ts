import { Context, SQSEvent } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { initMetrics } from "./common/metrics.js";
import { processConfig } from "./common/process-config.js";
import assert from "node:assert/strict"

const logger = new Logger();
const metrics = initMetrics("send-inactive-warning-email");

export const handler = async (
  event: SQSEvent,
  context: Context
): Promise<void> => {
  logger.addContext(context);


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
      return;
    }

  }

  metrics.publishStoredMetrics();
};
