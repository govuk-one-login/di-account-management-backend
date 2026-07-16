import { Context } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { initMetrics } from "./common/metrics.js";

const logger = new Logger();
const metrics = initMetrics("send-inactive-warning-email");

export const handler = async (
  event: unknown,
  context: Context
): Promise<void> => {
  logger.addContext(context);
  logger.info("hello world");
  metrics.publishStoredMetrics();
};
