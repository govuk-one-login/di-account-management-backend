import { SNSEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  DeleteCommand,
  DeleteCommandOutput,
} from "@aws-sdk/lib-dynamodb";
import {
  SendMessageCommand,
  SendMessageRequest,
  SQSClient,
} from "@aws-sdk/client-sqs";
import { UserData } from "./common/delete-user-services-models";

const marshallOptions = {
  convertClassInstanceToMap: true,
};
const translateConfig = { marshallOptions };

const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(
  dynamoClient,
  translateConfig
);

const sqsClient = new SQSClient({});

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

  await Promise.all(
    event.Records.map(async (record) => {
      try {
        const userData: UserData = JSON.parse(record.Sns.Message);
        validateUserData(userData);
        await deleteUserData(userData);
      } catch (err) {
        const message: SendMessageRequest = {
          QueueUrl: DLQ_URL,
          MessageBody: record.Sns.Message,
        };
        const result = await sqsClient.send(new SendMessageCommand(message));
        console.error(
          `[Message sent to DLQ] with message id = ${result.MessageId}`,
          err
        );
      }
    })
  );
};
