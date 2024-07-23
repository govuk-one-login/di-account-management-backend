import { SQSEvent } from "aws-lambda";
import crypto from "crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  PutCommandOutput,
} from "@aws-sdk/lib-dynamodb";
import { TxmaEvent, UserData } from "./common/model";
import { sendSqsMessage } from "./common/sqs";

const marshallOptions = {
  convertClassInstanceToMap: true,
};

const translateConfig = { marshallOptions };

const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(
  dynamoClient,
  translateConfig
);

const getEventId = (): string => {
  return crypto.randomUUID();
};

const getTTLDate = (): number => {
  const SECONDS_IN_A_DAY = 60 * 60 * 24;
  const secondsSinceEpoch = Math.round(Date.now() / 1000);
  const expirationTime = secondsSinceEpoch + 14 * SECONDS_IN_A_DAY;
  return expirationTime;
};

export const validateUser = (user: UserData): void => {
  if (!user.user_id || !user.session_id) {
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
    throw new Error("Could not validate TxmaEvent");
  }
};

export const writeRawTxmaEvent = async (
  txmaEvent: TxmaEvent
): Promise<PutCommandOutput> => {
  const { TABLE_NAME } = process.env;

  if (!TABLE_NAME) {
    throw new Error("TABLE_NAME environment variable is not defined");
  }

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

export const handler = async (event: SQSEvent): Promise<void> => {
  const { DLQ_URL } = process.env;

  if (!DLQ_URL) {
    throw new Error("DLQ_URL environment variable is not defined");
  }

  await Promise.all(
    event.Records.map(async (record) => {
      try {
        console.log(`Started processing message with ID: ${record.messageId}`);
        const txmaEvent: TxmaEvent = JSON.parse(record.body);
        validateTxmaEventBody(txmaEvent);
        await writeRawTxmaEvent(txmaEvent);
        console.log(`Finished processing message with ID: ${record.messageId}`);
      } catch (error) {
        console.error(`[Error occurred]: ${(error as Error).message}`);
        try {
          const result = await sendSqsMessage(record.body, DLQ_URL);
          console.error(
            `[Message sent to DLQ] with message id = ${result.MessageId}`
          );
        } catch (dlqError) {
          console.error(`Failed to send message to DLQ: `, dlqError);
        }
      }
    })
  );
};
