import { SQSEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  PutCommandOutput,
} from "@aws-sdk/lib-dynamodb";
import { Service, UserServices } from "./common/model";
import { sendSqsMessage } from "./common/sqs";

const dynamoDocClient = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { convertClassInstanceToMap: true },
});

export const validateService = (service: Service): void => {
  const {
    client_id,
    count_successful_logins,
    last_accessed,
    last_accessed_pretty,
  } = service;
  if (
    client_id === undefined ||
    count_successful_logins === undefined ||
    count_successful_logins < 0 ||
    last_accessed === undefined ||
    last_accessed_pretty === undefined
  ) {
    throw new Error(`Service validation failed for client_id: ${client_id}`);
  }
};

export const validateUserServices = (userServices: UserServices): void => {
  const { user_id, services } = userServices;
  if (user_id === undefined || services === undefined) {
    throw new Error(`UserServices validation failed for user_id: ${user_id}`);
  }
  services.forEach(validateService);
};

export const writeUserServices = async (
  userServices: UserServices
): Promise<PutCommandOutput> => {
  const { TABLE_NAME } = process.env;
  if (!TABLE_NAME) {
    throw new Error("TABLE_NAME environment variable is not set");
  }
  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: { user_id: userServices.user_id, services: userServices.services },
  });
  return dynamoDocClient.send(command);
};

export const handler = async (event: SQSEvent): Promise<void> => {
  const { DLQ_URL } = process.env;
  if (!DLQ_URL) {
    throw new Error("DLQ_URL environment variable is not set");
  }

  await Promise.all(
    event.Records.map(async (record) => {
      try {
        console.log(`Started processing message with ID: ${record.messageId}`);
        const userServices: UserServices = JSON.parse(record.body);
        validateUserServices(userServices);
        await writeUserServices(userServices);
        console.log(`Finished processing message with ID: ${record.messageId}`);
      } catch (error) {
        console.error(`[Error occurred]: ${(error as Error).message}`);
        try {
          const result = await sendSqsMessage(record.body, DLQ_URL);
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
