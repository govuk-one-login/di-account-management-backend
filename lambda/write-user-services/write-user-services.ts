import { SQSEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  PutCommandOutput,
} from "@aws-sdk/lib-dynamodb";
import {
  SendMessageCommand,
  SendMessageRequest,
  SQSClient,
} from "@aws-sdk/client-sqs";
import { Service, UserServices } from "./models";

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

export const validateServices = (services: Service[]): void => {
  for (let i = 0; i < services.length; i += 1) {
    const service = services[i];
    if (
      !(
        service.client_id !== undefined &&
        service.count_successful_logins &&
        service.count_successful_logins >= 0 &&
        service.last_accessed !== undefined &&
        service.last_accessed_pretty !== undefined
      )
    ) {
      throw new Error(`Could not validate Service`);
    }
  }
};

export const validateUserServices = (userServices: UserServices): void => {
  if (
    userServices.user_id !== undefined &&
    userServices.services !== undefined
  ) {
    validateServices(userServices.services);
  } else {
    throw new Error(`Could not validate UserServices`);
  }
};

export const writeUserServices = async (
  userServices: UserServices
): Promise<PutCommandOutput> => {
  const { TABLE_NAME } = process.env;
  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      user_id: userServices.user_id,
      services: userServices.services,
    },
  });
  return dynamoDocClient.send(command);
};

export const handler = async (event: SQSEvent): Promise<void> => {
  const { DLQ_URL } = process.env;
  await Promise.all(
    event.Records.map(async (record) => {
      try {
        const userServices: UserServices = JSON.parse(record.body);
        validateUserServices(userServices);
        await writeUserServices(userServices);
      } catch (err) {
        console.error(err);
        const message: SendMessageRequest = {
          QueueUrl: DLQ_URL,
          MessageBody: record.body,
        };
        await sqsClient.send(new SendMessageCommand(message));
      }
    })
  );
};
