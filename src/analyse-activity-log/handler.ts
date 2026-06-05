import { Logger } from "@aws-lambda-powertools/logger";
import { Context } from "aws-lambda";

const logger = new Logger({ serviceName: "analyse-activity-log" });

export interface AnalyseActivityLogEvent {
  totalSegments: number;
}

export const handler = async (
  event: AnalyseActivityLogEvent,
  context: Context
): Promise<void> => {
  logger.addContext(context);
  if (
    !event.totalSegments ||
    !Number.isInteger(event.totalSegments) ||
    event.totalSegments < 1
  ) {
    throw new Error("totalSegments must be a positive integer");
  }
  logger.info("Analysis started", { totalSegments: event.totalSegments });
};
