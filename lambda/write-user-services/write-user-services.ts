import { SQSEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  PutCommandOutput,
} from "@aws-sdk/lib-dynamodb";
import { Service, UserServices } from "./models";
import { getErrorMessage, ValidationError } from "./errors";

const TABLE_NAME = process.env.TABLE_NAME;
const marshallOptions = {
  convertClassInstanceToMap: true,
};
const translateConfig = { marshallOptions };

const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(
  dynamoClient,
  translateConfig
);

export const validateUserServices = (userServices: UserServices): void => {
  if (userServices.user_id != undefined && userServices.services != undefined) {
    validateServices(userServices.services);
  } else {
    throw new ValidationError(
      `Could not validate UserServices ${userServices}`
    );
  }
};

export const validateServices = (services: Service[]): void => {
  for (let i = 0; i < services.length; i++) {
    const service = services[i];
    if (
      service.client_id != undefined &&
      service.count_successful_logins &&
      service.count_successful_logins >= 0 &&
      service.last_accessed != undefined
    ) {
    } else {
      throw new ValidationError(`Could not validate Service ${service}`);
    }
  }
};

export const parseRecordBody = (body: string): UserServices => {
  return JSON.parse(body) as UserServices;
};

export const writeUserServices = async (
  userServices: UserServices
): Promise<PutCommandOutput> => {
  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      user_id: userServices.user_id,
      services: userServices.services,
    },
  });
  return await dynamoDocClient.send(command);
};

export const handler = async (event: SQSEvent): Promise<void> => {
  for (let i = 0; i < event.Records.length; i++) {
    try {
      const userServices = parseRecordBody(event.Records[i].body);
      validateUserServices(userServices);
      await writeUserServices(userServices);
    } catch (err) {
      console.error(`ERROR: ${getErrorMessage(err)}`);
    }
  }
};
