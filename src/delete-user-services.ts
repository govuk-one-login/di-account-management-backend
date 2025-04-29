import { Context, SNSEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  DeleteCommand,
  DeleteCommandOutput,
} from "@aws-sdk/lib-dynamodb";
import { UserData } from "./common/model";
import { getEnvironmentVariable } from "./common/utils";
import { Logger } from "@aws-lambda-powertools/logger";

const logger = new Logger();

const marshallOptions = {
  convertClassInstanceToMap: true,
};
const translateConfig = { marshallOptions };

const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(
  dynamoClient,
  translateConfig
);

export const validateUserData = (userData: UserData): UserData => {
  if (userData.user_id) {
    return userData;
  }
  throw new Error(
    `userData did not have a user_id: ${JSON.stringify(userData)}`
  );
};

export const deleteUserData = async (
  userData: UserData
): Promise<DeleteCommandOutput> => {
  const TABLE_NAME = getEnvironmentVariable("TABLE_NAME");
  const command = new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { user_id: userData.user_id },
  });
  return dynamoDocClient.send(command);
};

export const handler = async (
  event: SNSEvent,
  context: Context
): Promise<void> => {
  logger.addContext(context);
  await Promise.all(
    event.Records.map(async (record) => {
      try {
        logger.info(
          `started processing message with ID: ${record.Sns.MessageId}`
        );
        const userData: UserData = JSON.parse(record.Sns.Message);
        validateUserData(userData);
        await deleteUserData(userData);
        logger.info(
          `finished processing message with ID: ${record.Sns.MessageId}`
        );
      } catch (error) {
        throw new Error(
          `Unable to delete user services for message with ID: ${record.Sns.MessageId}, ${
            (error as Error).message
          }`
        );
      }
    })
  );
};
