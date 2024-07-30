import { DynamoDBStreamEvent } from "aws-lambda";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { AttributeValue, DynamoDBClient } from "@aws-sdk/client-dynamodb";

import {
  Service,
  TxmaEvent,
  UserData,
  UserRecordEvent,
  UserServices,
} from "./common/model";
import { sendSqsMessage } from "./common/sqs";
import { getEnvironmentVariable } from "./common/utils";

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
  const TABLE_NAME = getEnvironmentVariable("TABLE_NAME");
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
    throw new Error(`Could not validate User`);
  }
};

export const validateTxmaEventBody = (txmaEvent: TxmaEvent): void => {
  if (
    txmaEvent.timestamp !== undefined &&
    txmaEvent.event_name !== undefined &&
    txmaEvent.client_id !== undefined &&
    txmaEvent.user !== undefined
  ) {
    validateUser(txmaEvent.user);
  } else {
    throw new Error(`Could not validate UserServices`);
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

export const handler = async (event: DynamoDBStreamEvent): Promise<void> => {
  const { Records } = event;
  const OUTPUT_QUEUE_URL = getEnvironmentVariable("OUTPUT_QUEUE_URL");
  const DLQ_URL = getEnvironmentVariable("DLQ_URL");
  await Promise.all(
    Records.map(async (record) => {
      try {
        console.log(`started processing event with ID: ${record.eventID}`);
        const txmaEvent = unmarshall(
          record.dynamodb?.NewImage?.event.M as {
            [key: string]: AttributeValue;
          }
        ) as TxmaEvent;
        if (txmaEvent.event_name === "AUTH_AUTH_CODE_ISSUED") {
          validateTxmaEventBody(txmaEvent);
          const results = await queryUserServices(txmaEvent.user.user_id);
          const { MessageId: messageId } = await sendSqsMessage(
            JSON.stringify(createUserRecordEvent(txmaEvent, results)),
            OUTPUT_QUEUE_URL
          );
          console.log(`[Message sent to QUEUE] with message id = ${messageId}`);
        } else {
          console.log(
            `DB stream sent a ${txmaEvent.event_name} event. Irrelevant for service card so ignoring`
          );
        }
        console.log(`finished processing event with ID: ${record.eventID}`);
      } catch (err) {
        const { MessageId: messageId } = await sendSqsMessage(
          JSON.stringify(record),
          DLQ_URL
        );
        console.error(
          `[Message sent to DLQ] with message id = ${messageId}`,
          err
        );
      }
    })
  );
};
