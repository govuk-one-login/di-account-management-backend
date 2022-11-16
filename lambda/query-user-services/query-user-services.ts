import { DynamoDBStreamEvent } from "aws-lambda";
import { DynamoDB } from "aws-sdk";
import {
  SendMessageCommand,
  SendMessageRequest,
  SQSClient,
} from "@aws-sdk/client-sqs";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  RawTxmaEvent,
  Service,
  TxmaEvent,
  UserData,
  UserRecordEvent,
  UserServices,
} from "./models";

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
  const { TABLE_NAME } = process.env;

  const command = new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      user_id: userId,
    },
  });
  const results = await dynamoDocClient.send(command);

  return results.Item ? (results.Item as UserServices).services : [];
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
  messageBody: string,
  queueUrl: string | undefined
): Promise<string | undefined> => {
  const { AWS_REGION } = process.env;
  const client = new SQSClient({ region: AWS_REGION });
  const message: SendMessageRequest = {
    QueueUrl: queueUrl,
    MessageBody: messageBody,
  };
  const result = await client.send(new SendMessageCommand(message));
  return result.MessageId;
};

export const handler = async (event: DynamoDBStreamEvent): Promise<void> => {
  const { OUTPUT_QUEUE_URL, DLQ_URL } = process.env;
  const { Records } = event;
  await Promise.all(
    Records.map(async (record) => {
      try {
        const rawTxmaEvent = DynamoDB.Converter.unmarshall(
          record.dynamodb?.NewImage || {}
        ) as RawTxmaEvent;
        console.log(`RAW TXMA : ${JSON.stringify(rawTxmaEvent)}`);
        validateTxmaEventBody(rawTxmaEvent.event);
        const results = await queryUserServices(
          rawTxmaEvent.event.user.user_id
        );
        const messageId = await sendSqsMessage(
          JSON.stringify(createUserRecordEvent(rawTxmaEvent.event, results)),
          OUTPUT_QUEUE_URL
        );
        console.log(`[Message sent to QUEUE] with message id = ${messageId}`);
      } catch (err) {
        console.error(err);
        await sendSqsMessage(JSON.stringify(record), DLQ_URL);
      }
    })
  );
};
