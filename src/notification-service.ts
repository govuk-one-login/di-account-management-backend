import {
  Context,
  SQSEvent,
  SQSBatchResponse,
  SQSBatchItemFailure,
} from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { initMetrics } from "./common/metrics.js";
import { processNotification } from "./notification-service-utils.js";

const logger = new Logger();
const metrics = initMetrics("notification-service");

export const handler = async (
  event: SQSEvent,
  context: Context
): Promise<SQSBatchResponse> => {
  logger.addContext(context);

  const batchItemFailures: SQSBatchItemFailure[] = [];

  await Promise.allSettled(
    event.Records.map((record) =>
      processNotification(record, batchItemFailures)
    )
  );

  metrics.publishStoredMetrics();

  return {
    batchItemFailures,
  };
};
