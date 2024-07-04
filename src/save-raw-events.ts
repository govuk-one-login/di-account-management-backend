import { SQSEvent } from "aws-lambda";
import crypto from "crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  PutCommandOutput,
} from "@aws-sdk/lib-dynamodb";
import {
  SendMessageCommand,
  SendMessageRequest,
  SQSClient,
} from "@aws-sdk/client-sqs";
import { TxmaEvent, UserData } from "./common/model";

const marshallOptions = {
  convertClassInstanceToMap: true,
};
const translateConfig = { marshallOptions };

const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(
  dynamoClient,
  translateConfig,
);
const sqsClient = new SQSClient({});

export const getEventId = (): string => {
  return `${crypto.randomUUID()}`;
};

export const getTTLDate = (): number => {
  const SECONDS_IN_AN_DAY = 60 * 60 * 24;
  const secondsSinceEpoch = Math.round(Date.now() / 1000);
  const expirationTime = secondsSinceEpoch + 14 * SECONDS_IN_AN_DAY;
  return expirationTime;
};

export const validateUser = (user: UserData): void => {
  if (!user.user_id || !user.session_id) {
    throw new Error(`Could not validate User`);
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
    throw new Error(`Could not validate UserServices`);
  }
};

export const writeRawTxmaEvent = async (
  txmaEvent: TxmaEvent,
): Promise<PutCommandOutput> => {
  const { TABLE_NAME } = process.env;

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

  await Promise.all(
    event.Records.map(async (record) => {
      try {
        const txmaEvent: TxmaEvent = JSON.parse(record.body);
        validateTxmaEventBody(txmaEvent);
        await writeRawTxmaEvent(txmaEvent);
      } catch (err) {
        const message: SendMessageRequest = {
          QueueUrl: DLQ_URL,
          MessageBody: record.body,
        };
        const result = await sqsClient.send(new SendMessageCommand(message));
        console.error(
          `[Message sent to DLQ] aaa with message id = ${result.MessageId}`,
          err,
        );
      }
    }),
  );
};
