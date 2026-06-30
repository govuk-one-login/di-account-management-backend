import { Context, DynamoDBStreamEvent } from "aws-lambda";
import { AttributeValue } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { TxmaEvent } from "./common/model.js";
import { Logger } from "@aws-lambda-powertools/logger";

const logger = new Logger();

export const handler = async (
  event: DynamoDBStreamEvent,
  context: Context
): Promise<void> => {
  logger.addContext(context);

  for (const record of event.Records) {
    const txmaEvent = unmarshall(
      record.dynamodb?.NewImage?.event.M as Record<string, AttributeValue>
    ) as TxmaEvent;

    const userId = txmaEvent.user?.user_id;
    if (!userId) {
      throw new Error("user_id is missing from the event");
    }

    const newEmail = txmaEvent.user?.email;
    if (!newEmail) {
      throw new Error("email is missing from the event");
    }

    logger.info("Processing email update event", {
      userId,
      eventName: txmaEvent.event_name,
    });
  }
};
