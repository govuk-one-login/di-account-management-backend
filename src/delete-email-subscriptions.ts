import { Context, SNSEvent } from "aws-lambda";
import { UserData } from "./common/model.js";
import { Logger } from "@aws-lambda-powertools/logger";
import {
  deleteEmailSubscription,
  validateUserData,
} from "./delete-email-subscriptions-utils.js";

const logger = new Logger();

const retryDeleteEmailSubscription = async (
  userData: UserData
): Promise<void> => {
  const retries = 3;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await deleteEmailSubscription(userData);
      return;
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      logger.warn("Attempt to delete email subscription has failed. Retrying");
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
};

export const handler = async (
  event: SNSEvent,
  context: Context
): Promise<void> => {
  logger.addContext(context);
  await Promise.all(
    event.Records.map(async (record) => {
      try {
        logger.info(
          `started processing message with ID: ${record.Sns.MessageId}`
        );
        const userData: UserData = JSON.parse(record.Sns.Message);
        validateUserData(userData);
        await retryDeleteEmailSubscription(userData);
        logger.info(
          `finished processing message with ID: ${record.Sns.MessageId}`
        );
      } catch (error) {
        throw new Error(
          `Unable to delete activity log for message with ID: ${record.Sns.MessageId}, ${
            (error as Error).message
          }`,
          { cause: error }
        );
      }
    })
  );
};
