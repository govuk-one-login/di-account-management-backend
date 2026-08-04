import { Context, SQSBatchResponse, SQSEvent } from "aws-lambda";
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

const ALLOWED_EVENT_NAMES = new Set([
  "AUTH_AUTH_CODE_ISSUED",
  "AUTH_IPV_AUTHORISATION_REQUESTED",
  "AUTH_IPV_SUCCESSFUL_IDENTITY_RESPONSE_RECEIVED",
]);

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
      timestamp: txmaEvent.timestamp,
      eventName: txmaEvent.event_name,
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
): Promise<SQSBatchResponse> => {
  logger.addContext(context);
  const batchItemFailures: { itemIdentifier: string }[] = [];

  logger.info("DEBUG: handler invoked", {
    recordCount: event.Records.length,
  });

  await Promise.all(
    event.Records.map(async (record) => {
      try {
        const txmaEvent: TxmaEvent = JSON.parse(record.body);

        logger.info("DEBUG: received event", {
          messageId: record.messageId,
          event_name: txmaEvent.event_name,
          event_id: txmaEvent.event_id,
          user_id: txmaEvent.user?.user_id,
          session_id: txmaEvent.user?.session_id,
          client_id: txmaEvent.client_id,
          timestamp: txmaEvent.timestamp,
          hasUser: txmaEvent.user !== undefined && txmaEvent.user !== null,
          rawBodyLength: record.body.length,
          allTopLevelKeys: Object.keys(txmaEvent),
        });

        if (!ALLOWED_EVENT_NAMES.has(txmaEvent.event_name as string)) {
          logger.info(
            `Ignoring ${txmaEvent.event_name} event - not in allowlist`
          );
          return;
        }

        validateTxmaEventBody(txmaEvent);

        logger.info("DEBUG: validation passed, writing to DynamoDB", {
          event_name: txmaEvent.event_name,
          event_id: txmaEvent.event_id,
          user_id: txmaEvent.user?.user_id,
        });

        await writeRawTxmaEvent(txmaEvent);

        logger.info("DEBUG: successfully written to DynamoDB", {
          event_name: txmaEvent.event_name,
          event_id: txmaEvent.event_id,
          user_id: txmaEvent.user?.user_id,
        });
      } catch (error) {
        logger.error(
          `Unable to save raw events for message with ID: ${record.messageId}`,
          { error }
        );
        batchItemFailures.push({ itemIdentifier: record.messageId });
      }
    })
  );

  logger.info("DEBUG: handler complete", {
    batchItemFailureCount: batchItemFailures.length,
  });

  return { batchItemFailures };
};
