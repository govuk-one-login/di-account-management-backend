import { SQSEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  PutCommandOutput,
} from "@aws-sdk/lib-dynamodb";
import { UserServices } from "./models";

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

export const validateUserServices = (userServices: UserServices): boolean => {
  return true;
};

export const writeEvent = async (
  userServices: UserServices
): Promise<PutCommandOutput> => {
  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      user_id: userServices.user_id,
      services: userServices.services,
    },
  });
  console.log(userServices);
  return await dynamoDocClient.send(command);
};

export const lambdaHandler = async (event: SQSEvent): Promise<void> => {
  for (let i = 0; i < event.Records.length; i++) {
    const userServices: UserServices = JSON.parse(event.Records[i].body);
    if (validateUserServices(userServices)) {
      await writeEvent(userServices);
    }
  }
};
