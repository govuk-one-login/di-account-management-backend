import { SQSEvent, SQSRecord } from "aws-lambda";
import { Service, TxmaEvent, UserData, UserRecordEvent } from "./models";
import {
  SendMessageCommand,
  SendMessageRequest,
  SQSClient,
} from "@aws-sdk/client-sqs";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

const { TABLE_NAME, AWS_REGION } = process.env;
const QUEUE_URL = "";
const marshallOptions = {
  convertClassInstanceToMap: true,
};
const translateConfig = { marshallOptions };

const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(
  dynamoClient,
  translateConfig
);

export const queryUserServices = async (userId: string): Promise<Service[]> => {
  const command = new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      userId: userId,
    },
  });
  const results = await dynamoDocClient.send(command);

  return results.Item ? (results.Item as Service[]) : [];
};

export const validateUser = (user: UserData): void => {
  if (user.user_id === undefined) {
    throw new Error(`Could not find User ${user}`);
  }
};

export const validateTxmaEventBody = (txmaEvent: TxmaEvent): void => {
  if (
    txmaEvent.client_id !== undefined &&
    txmaEvent.timestamp !== undefined &&
    txmaEvent.event_name !== undefined &&
    txmaEvent.component_id !== undefined &&
    txmaEvent.user !== undefined
  ) {
    validateUser(txmaEvent.user);
  } else {
    throw new Error(`Could not validate UserServices ${txmaEvent}`);
  }
};

const createUserRecordEvent = (
  txmaEvent: TxmaEvent,
  results: Service[]
): UserRecordEvent => {
  const userRecordEvent: UserRecordEvent = {
    TxmaEvent: txmaEvent,
    ServiceList: results,
  };
  return userRecordEvent;
};

export const sendSqsMessage = async (
  messageBody: object,
  queueUrl: string
): Promise<string | undefined> => {
  const client = new SQSClient({ region: AWS_REGION });
  const message: SendMessageRequest = {
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(messageBody),
  };
  const result = await client.send(new SendMessageCommand(message));
  return result.MessageId;
};

export const handler = async (event: SQSEvent): Promise<void> => {
  for (const record of event.Records) {
    const txmaEvent: TxmaEvent = JSON.parse(record.body);
    validateTxmaEventBody(txmaEvent);
    const results = await queryUserServices(txmaEvent.user.user_id);
    const messageId = await sendSqsMessage(
      createUserRecordEvent(txmaEvent, results),
      QUEUE_URL
    );
    console.log(`[Message sent to QUEUE] with message id = ${messageId}`);
  }
};
