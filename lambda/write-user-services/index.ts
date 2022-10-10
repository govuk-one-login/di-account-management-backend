import { SQSEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  PutCommandOutput,
} from "@aws-sdk/lib-dynamodb";
import { UserServices } from "./models";
import { getErrorMessage } from "./errors";
import { validateUserServices } from "./validate";

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

export const lambdaHandler = async (event: SQSEvent): Promise<void> => {
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
