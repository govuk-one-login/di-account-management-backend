import { SQSEvent } from "aws-lambda";
import crypto from "crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  PutCommandOutput,
} from "@aws-sdk/lib-dynamodb";
import { TxmaEvent, UserData } from "./common/model";
import { getEnvironmentVariable } from "./common/utils";

const TABLE_NAME = getEnvironmentVariable("TABLE_NAME");

const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    convertClassInstanceToMap: true,
  },
});

const getTTLDate = (): number => {
  const secondsInADay = 60 * 60 * 24;
  const secondsSinceEpoch = Math.round(Date.now() / 1000);
  const expirationTime = secondsSinceEpoch + 14 * secondsInADay;
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
  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      event: txmaEvent,
      remove_at: getTTLDate(),
    },
  });
  return dynamoDocClient.send(command);
};

export const handler = async (event: SQSEvent): Promise<void> => {
  await Promise.all(
    event.Records.map(async (record) => {
      try {
        const txmaEvent: TxmaEvent = JSON.parse(record.body);
        validateTxmaEventBody(txmaEvent);
        await writeRawTxmaEvent(txmaEvent);
      } catch (error) {
        throw new Error(
          `Unable to save raw events for message with ID: ${record.messageId}, ${
            (error as Error).message
          }`
        );
      }
    })
  );
};
