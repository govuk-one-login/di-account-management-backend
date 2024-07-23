import { SNSEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  DeleteCommand,
  DeleteCommandOutput,
} from "@aws-sdk/lib-dynamodb";
import { UserData } from "./common/model";
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
  const { TABLE_NAME } = process.env;

  const command = new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { user_id: userData.user_id },
  });
  return dynamoDocClient.send(command);
};

export const handler = async (event: SNSEvent): Promise<void> => {
  const { DLQ_URL } = process.env;
  if (!DLQ_URL) {
    throw new Error("DLQ_URL environment variable is not set");
  }

  await Promise.all(
    event.Records.map(async (record) => {
      try {
        console.log(
          `started processing message with ID: ${record.Sns.MessageId}`
        );
        const userData: UserData = JSON.parse(record.Sns.Message);
        validateUserData(userData);
        await deleteUserData(userData);
        console.log(
          `finished processing message with ID: ${record.Sns.MessageId}`
        );
      } catch (error) {
        console.error(`[Error occurred]: ${(error as Error).message}`);
        try {
          const result = await sendSqsMessage(record.Sns.Message, DLQ_URL);
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
