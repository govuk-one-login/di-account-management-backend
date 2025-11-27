import { SQSEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  PutCommandOutput,
} from "@aws-sdk/lib-dynamodb";
import { Logger } from "@aws-lambda-powertools/logger";
import { Service, UserServices } from "./common/model";
import { getEnvironmentVariable } from "./common/utils";

const logger = new Logger();

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
  const TABLE_NAME = getEnvironmentVariable("TABLE_NAME");
  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: { user_id: userServices.user_id, services: userServices.services },
  });
  return dynamoDocClient.send(command);
};

export const handler = async (event: SQSEvent): Promise<void> => {
  await Promise.all(
    event.Records.map(async (record) => {
      try {
        const userServices: UserServices = JSON.parse(record.body);
        validateUserServices(userServices);
        logger.info(
          `Writing user services with item size ${Buffer.byteLength(record.body, "utf8")} bytes`
        );
        await writeUserServices(userServices);
      } catch (error) {
        throw new Error(
          `Unable to write user services for message with ID: ${record.messageId}, ${
            (error as Error).message
          }`
        );
      }
    })
  );
};
