import { Context, SNSEvent } from "aws-lambda";
import { UserData } from "./common/model";
import { Logger } from "@aws-lambda-powertools/logger";
import {
  deleteEmailSubscription,
  validateUserData,
} from "./delete-email-subscriptions-utils";

const logger = new Logger();

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
        await deleteEmailSubscription(userData);
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
