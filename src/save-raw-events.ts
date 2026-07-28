import { Context, SQSEvent } from "aws-lambda";
import crypto from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  PutCommandOutput,
} from "@aws-sdk/lib-dynamodb";
import { TxmaEvent, UserData } from "./common/model.js";
import { getEnvironmentVariable } from "./common/utils.js";
import { Logger } from "@aws-lambda-powertools/logger";

const marshallOptions = {
  convertClassInstanceToMap: true,
};
const translateConfig = { marshallOptions };
const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(
  dynamoClient,
  translateConfig
);
const logger = new Logger();

const getEventId = (): string => {
  return crypto.randomUUID();
};

const getTTLDate = (): number => {
  const secondsInADay = 60 * 60 * 24;
  const secondsSinceEpoch = Math.round(Date.now() / 1000);
  const expirationTime = secondsSinceEpoch + 14 * secondsInADay;
  return expirationTime;
};

export const validateUser = (user: UserData): void => {
  if (!user.user_id || !user.session_id) {
    logger.info("Could not validate User context", {
      typeofUser: typeof user,
      typeofUserUserId: typeof user.user_id,
      typeofUserSessionId: typeof user.session_id,
    });
    throw new Error("Could not validate User");
  }
};

export const validateTxmaEventBody = (txmaEvent: TxmaEvent): void => {
  if (
    txmaEvent.timestamp &&
    txmaEvent.event_name &&
    txmaEvent.client_id &&
    txmaEvent.user
  ) {
    validateUser(txmaEvent.user);
  } else {
    logger.info("Could not validate TxmaEvent context", {
      typeofTimestamp: typeof txmaEvent.timestamp,
      typeofEventName: typeof txmaEvent.event_name,
      typeofClientId: typeof txmaEvent.client_id,
      typeofUser: typeof txmaEvent.user,
    });
    throw new Error("Could not validate TxmaEvent");
  }
};

export const writeRawTxmaEvent = async (
  txmaEvent: TxmaEvent
): Promise<PutCommandOutput> => {
  const TABLE_NAME = getEnvironmentVariable("TABLE_NAME");
  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      id: getEventId(),
      timestamp: Date.now(),
      event: txmaEvent,
      remove_at: getTTLDate(),
    },
  });

  return dynamoDocClient.send(command);
};

export const handler = async (
  event: SQSEvent,
  context: Context
): Promise<void> => {
  logger.addContext(context);
  await Promise.all(
    event.Records.map(async (record) => {
      try {
        const txmaEvent: TxmaEvent = JSON.parse(record.body);

        // TODO: Remove once AUTH_TOKEN_SENT_TO_ORCHESTRATION backlog is cleared
        if (txmaEvent.event_name === "AUTH_TOKEN_SENT_TO_ORCHESTRATION") {
          logger.info(
            "Ignoring AUTH_TOKEN_SENT_TO_ORCHESTRATION event - temporary measure to clear backlog"
          );
          return;
        }

        validateTxmaEventBody(txmaEvent);
        await writeRawTxmaEvent(txmaEvent);
      } catch (error) {
        throw new Error(
          `Unable to save raw events for message with ID: ${record.messageId}, ${
            (error as Error).message
          }`,
          { cause: error }
        );
      }
    })
  );
};
