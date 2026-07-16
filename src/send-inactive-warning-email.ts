import { Context, SQSEvent } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { initMetrics } from "./common/metrics.js";

const logger = new Logger();
const metrics = initMetrics("send-inactive-warning-email");

export const handler = async (
  event: SQSEvent,
  context: Context
): Promise<void> => {
  logger.addContext(context);

  for (const record of event.Records) {
    const body = JSON.parse(record.body);
    logger.info("Processing inactive account warning", {
      commonSubjectId: body.commonSubjectId,
      processName: body.processName,
    });
  }

  metrics.publishStoredMetrics();
};
