import { Context, SNSEvent } from "aws-lambda";
import { UserData } from "./common/model.js";
import { Logger } from "@aws-lambda-powertools/logger";
import {
  deleteEmailSubscription,
  validateUserData,
} from "./delete-email-subscriptions-utils.js";
import { retryFunction } from "./common/retry-function.js";

const logger = new Logger();

export const handler = async (
  event: SNSEvent,
  context: Context
): Promise<void> => {
  logger.addContext(context);
  await Promise.all(
    event.Records.map(async (record) => {
      let userData: UserData;

      try {
        userData = JSON.parse(record.Sns.Message);
        validateUserData(userData);
      } catch (error) {
        logger.error(
          `Unable to delete email subscription for message with ID: ${record.Sns.MessageId}. This message will never be actionable and has been skipped: ${
            (error as Error).message
          }`
        );
        return;
      }

      try {
        logger.info(
          `started processing message with ID: ${record.Sns.MessageId}`
        );
        await retryFunction(() => deleteEmailSubscription(userData), {
          functionName: "deleteEmailSubscription",
        });
        logger.info(
          `finished processing message with ID: ${record.Sns.MessageId}`
        );
      } catch (error) {
        throw new Error(
          `Unable to delete email subscription for message with ID: ${record.Sns.MessageId}, ${
            (error as Error).message
          }`,
          { cause: error }
        );
      }
    })
  );
};
