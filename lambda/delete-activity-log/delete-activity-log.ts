import { SNSEvent } from "aws-lambda";
import {
  DynamoDBClient,
  BatchWriteItemCommand,
  WriteRequest,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import {
  SendMessageCommand,
  SendMessageRequest,
  SQSClient,
} from "@aws-sdk/client-sqs";
import { ActivityLogEntry, UserData } from "./models";

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

export const getAllActivitiesoForUser = async (
  userData: UserData
): Promise<ActivityLogEntry[] | undefined> => {
  const { TABLE_NAME } = process.env;
  const command = {
    TableName: TABLE_NAME,
    KeyConditionExpression: "user_id = :user_id",
    ExpressionAttributeValues: {
      ":user_id": userData.user_id,
    },
    // TODO: make multiple requests when dynamo has truncated the response to 10MB
  };

  const response = await dynamoDocClient.send(new QueryCommand(command));
  return response.Items ? (response.Items as ActivityLogEntry[]) : undefined;
};

const arraySplitIntoBatchesOf25 = (
  arrayToSplit: WriteRequest[]
): WriteRequest[][] => {
  const newArrayOfArrays: WriteRequest[][] = [];
  let itemsLeftToSplit: WriteRequest[] = arrayToSplit;
  do {
    newArrayOfArrays.push(itemsLeftToSplit.slice(0, 25));
    itemsLeftToSplit = itemsLeftToSplit.slice(25);
  } while (itemsLeftToSplit.length > 0);
  return newArrayOfArrays;
};

export const batchDeletionRequestArray = (
  activityLogEntries: ActivityLogEntry[]
): WriteRequest[][] => {
  return arraySplitIntoBatchesOf25(
    activityLogEntries.map((entry) => ({
      DeleteRequest: {
        Key: {
          user_id: { S: entry.user_id },
          timestamp: { N: entry.timestamp.toString() },
        },
      },
    }))
  );
};

export const batchDeleteActivityLog = async (
  activityLogEntries: ActivityLogEntry[]
) => {
  const batchArray = batchDeletionRequestArray(activityLogEntries);
  Promise.all(
    batchArray.map(async (array) => {
      try {
        const batchcommand = new BatchWriteItemCommand({
          RequestItems: {
            activity_logs: array,
          },
        });
        await dynamoDocClient.send(batchcommand);
      } catch (error) {
        console.error("Error occurred during batch delete:", error);
        throw error;
      }
    })
  );
};

export const handler = async (event: SNSEvent): Promise<void> => {
  const { DLQ_URL } = process.env;

  await Promise.all(
    event.Records.map(async (record) => {
      try {
        const userData: UserData = JSON.parse(record.Sns.Message);
        validateUserData(userData);
        const activityRecords: ActivityLogEntry[] | undefined =
          await getAllActivitiesoForUser(userData);
        if (activityRecords) {
          await batchDeleteActivityLog(activityRecords);
        }
      } catch (err) {
        console.error(err);
        const message: SendMessageRequest = {
          QueueUrl: DLQ_URL,
          MessageBody: record.Sns.Message,
        };
        console.log("sending message to SQS %s", JSON.stringify(message));
        await sqsClient.send(new SendMessageCommand(message));
      }
    })
  );
};
