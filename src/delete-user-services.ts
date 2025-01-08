import { SNSEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  DeleteCommand,
  DeleteCommandOutput,
} from "@aws-sdk/lib-dynamodb";
import { UserData } from "./common/model";
import { getEnvironmentVariable } from "./common/utils";

const TABLE_NAME = getEnvironmentVariable("TABLE_NAME");

const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: { convertClassInstanceToMap: true },
});

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
  const command = new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { user_id: userData.user_id },
  });
  return dynamoDocClient.send(command);
};

export const handler = async (event: SNSEvent): Promise<void> => {
  await Promise.all(
    event.Records.map(async (record) => {
      try {
        const userData: UserData = JSON.parse(record.Sns.Message);
        validateUserData(userData);
        await deleteUserData(userData);
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
