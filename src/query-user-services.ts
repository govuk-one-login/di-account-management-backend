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

const TABLE_NAME = getEnvironmentVariable("TABLE_NAME");
const OUTPUT_QUEUE_URL = getEnvironmentVariable("OUTPUT_QUEUE_URL");

const dynamoDocClient = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: {
    convertClassInstanceToMap: true,
  },
});

export const queryUserServices = async (userId: string): Promise<Service[]> => {
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
): UserRecordEvent => ({
  TxmaEvent: txmaEvent,
  ServiceList: results,
});

export const handler = async (event: DynamoDBStreamEvent): Promise<void> => {
  await Promise.all(
    event.Records.map(async (record) => {
      try {
        const txmaEvent = unmarshall(
          record.dynamodb?.NewImage?.event.M as Record<string, AttributeValue>
        ) as TxmaEvent;
        if (txmaEvent.event_name === "AUTH_AUTH_CODE_ISSUED") {
          validateTxmaEventBody(txmaEvent);
          const results = await queryUserServices(txmaEvent.user.user_id);
          await sendSqsMessage(
            JSON.stringify(createUserRecordEvent(txmaEvent, results)),
            OUTPUT_QUEUE_URL
          );
        }
      } catch (error) {
        throw new Error(
          `Unable to query user services for message with ID: ${record.eventID}, ${
            (error as Error).message
          }`
        );
      }
    })
  );
};
