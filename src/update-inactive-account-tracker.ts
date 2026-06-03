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
  logger.info("UpdateInactiveAccountTracker invoked");

  for (const record of event.Records) {
    const txmaEvent = unmarshall(
      record.dynamodb?.NewImage?.event.M as Record<string, AttributeValue>
    ) as TxmaEvent;
    logger.info(`client_id: ${txmaEvent.client_id}`);
  }
};
