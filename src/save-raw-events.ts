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
  "AUTH_TOKEN_SENT_TO_ORCHESTRATION",
  "AUTH_UPDATE_EMAIL",
]);

// AUTH_TOKEN_SENT_TO_ORCHESTRATION has no session_id in its schema, as the
// authentication session is already over by the time the token is exchanged.
const EVENTS_WITHOUT_SESSION_ID = new Set(["AUTH_TOKEN_SENT_TO_ORCHESTRATION"]);

const getEventId = (): string => {
  return crypto.randomUUID();
};

const getTTLDate = (): number => {
  const secondsInADay = 60 * 60 * 24;
  const secondsSinceEpoch = Math.round(Date.now() / 1000);
  const expirationTime = secondsSinceEpoch + 14 * secondsInADay;
  return expirationTime;
};

export const validateUser = (event: TxmaEvent): void => {
  const user:UserData = event.user;
  const requiresSessionId = !EVENTS_WITHOUT_SESSION_ID.has(event.event_name);

  if (!user.user_id || (requiresSessionId && !user.session_id)) {
    logger.info("Could not validate User context", {
      typeofUser: typeof user,
      typeofUserUserId: typeof user.user_id,
      typeofUserSessionId: typeof user.session_id,
    });
    const missingFields: string[] = [];

    if (!user.user_id) {
      missingFields.push(`user_id is ${user.user_id}`);
    }
    if (requiresSessionId && !user.session_id) {
      missingFields.push(`session_id is ${user.session_id}`);
    }
    throw new Error(`Could not validate User for event_name ${event.event_name} with event_id ${event.event_id}: ${missingFields.join(", ")}`);
  }
};

export const validateTxmaEventBody = (txmaEvent: TxmaEvent): void => {
  if (
    txmaEvent.timestamp &&
    txmaEvent.event_name &&
    txmaEvent.event_id &&
    txmaEvent.client_id &&
    txmaEvent.user
  ) {
    validateUser(txmaEvent);
  } else {
    const missingFields: string[] = [];
    if (!txmaEvent.timestamp) missingFields.push(`txmaEvent.timestamp is ${txmaEvent.timestamp}`);
    if (!txmaEvent.event_name) missingFields.push(`txmaEvent.event_name is ${txmaEvent.event_name}`);
    if (!txmaEvent.event_id) missingFields.push(`txmaEvent.event_id is ${txmaEvent.event_id}`);
    if (!txmaEvent.client_id) missingFields.push(`txmaEvent.client_id is ${txmaEvent.client_id}`);
    if (!txmaEvent.user) missingFields.push(`txmaEvent.user is ${txmaEvent.user}`);
    logger.info("Could not validate TxmaEvent context", {
      timestamp: txmaEvent.timestamp,
      eventName: txmaEvent.event_name,
      eventId: txmaEvent.event_id,
      typeofClientId: typeof txmaEvent.client_id,
      typeofUser: typeof txmaEvent.user,
    });
    throw new Error(`Could not validate TxmaEvent with id ${txmaEvent.event_id} and name ${txmaEvent.event_name}: ${missingFields.join(", ")}`);
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

  await Promise.all(
    event.Records.map(async (record) => {
      try {
        const txmaEvent: TxmaEvent = JSON.parse(record.body);

        if (!ALLOWED_EVENT_NAMES.has(txmaEvent.event_name as string)) {
          logger.info(
            `Ignoring ${txmaEvent.event_name} event - not in allowlist`
          );
          return;
        }

        validateTxmaEventBody(txmaEvent);
        await writeRawTxmaEvent(txmaEvent);
      } catch (error) {
        logger.error(
          `Unable to save raw events for message with ID: ${record.messageId}`,
          { error }
        );
        batchItemFailures.push({ itemIdentifier: record.messageId });
      }
    })
  );

  return { batchItemFailures };
};
