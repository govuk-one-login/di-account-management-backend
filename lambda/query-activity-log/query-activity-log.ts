import { DynamoDBStreamEvent } from "aws-lambda";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { AttributeValue, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import {
  SendMessageCommand,
  SendMessageRequest,
  SQSClient,
} from "@aws-sdk/client-sqs";
import {
  Activity,
  ActivityLogEntry,
  EncryptedActivityLogEntry,
  TxmaEvent,
  UserActivityLog,
  UserData,
  allowedTxmaEvents,
} from "./models";
import decryptData from "./decrypt-data";

const marshallOptions = {
  convertClassInstanceToMap: true,
};
const translateConfig = { marshallOptions };

const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(
  dynamoClient,
  translateConfig
);

export const queryActivityLog = async (
  userId: string,
  sessionId: string
): Promise<EncryptedActivityLogEntry | undefined> => {
  const { TABLE_NAME } = process.env;
  const command = {
    TableName: TABLE_NAME,
    KeyConditionExpression: "user_id = :user_id ",
    FilterExpression: "session_id = :session_id",
    ExpressionAttributeValues: {
      ":user_id": userId,
      ":session_id": sessionId,
    },
  };

  const response = await dynamoDocClient.send(new QueryCommand(command));
  return response.Items
    ? (response.Items[0] as EncryptedActivityLogEntry)
    : undefined;
};

export const decryptActivityLog = async (
  encrypted?: EncryptedActivityLogEntry | undefined
): Promise<ActivityLogEntry | undefined> => {
  if (!encrypted) {
    return undefined;
  }
  const activities = JSON.parse(
    await decryptData(encrypted.activities)
  ) as Activity[];

  return {
    session_id: encrypted.session_id,
    user_id: encrypted.user_id,
    event_type: encrypted.event_type,
    timestamp: encrypted.timestamp,
    activities,
    truncated: encrypted.truncated,
  };
};

export const validateUser = (user: UserData): void => {
  if (!user.user_id || !user.session_id) {
    throw new Error(`Could not validate User`);
  }
};

export const validateTxmaEventBody = (txmaEvent: TxmaEvent): void => {
  if (
    txmaEvent.timestamp !== undefined &&
    txmaEvent.event_name !== undefined &&
    txmaEvent.client_id !== undefined &&
    txmaEvent.user !== undefined &&
    txmaEvent.event_id !== undefined
  ) {
    validateUser(txmaEvent.user);
  } else {
    throw new Error(`Could not validate UserServices`);
  }
};

const createUserActivityLog = (
  txmaEvent: TxmaEvent,
  results: ActivityLogEntry | undefined
): UserActivityLog => {
  const userActivityLog: UserActivityLog = {
    txmaEvent,
    activityLogEntry: results,
  };
  return userActivityLog;
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
        const txmaEvent = unmarshall(
          record.dynamodb?.NewImage?.event.M as {
            [key: string]: AttributeValue;
          }
        ) as TxmaEvent;
        if (allowedTxmaEvents.includes(txmaEvent.event_name)) {
          validateTxmaEventBody(txmaEvent);
          const results = await queryActivityLog(
            txmaEvent.user.user_id,
            txmaEvent.user.session_id
          );
          const decrypted = await decryptActivityLog(results);
          const messageId = await sendSqsMessage(
            JSON.stringify(createUserActivityLog(txmaEvent, decrypted)),
            OUTPUT_QUEUE_URL
          );
          console.log(`[Message sent to QUEUE] with message id = ${messageId}`);
        } else {
          console.log(
            `DB stream sent a ${txmaEvent.event_name} event. Irrelevant for activity log so ignoring`
          );
        }
      } catch (err) {
        const messageId = await sendSqsMessage(JSON.stringify(record), DLQ_URL);
        console.error(
          `[Message sent to DLQ] with message id = ${messageId}`,
          err
        );
      }
    })
  );
};
