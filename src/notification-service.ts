import {
  Context,
  SQSEvent,
  SQSBatchResponse,
  SQSBatchItemFailure,
} from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";

const logger = new Logger();

export const handler = async (
  event: SQSEvent,
  context: Context
): Promise<SQSBatchResponse> => {
  logger.addContext(context);

  const batchItemFailures: SQSBatchItemFailure[] = [];

  // TODO

  return {
    batchItemFailures,
  };
};
