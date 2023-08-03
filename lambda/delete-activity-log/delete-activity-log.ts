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
  throw new Error(`userData did not have a user_id`);
};

export const getAllActivitiesoForUser = async (
  userData: UserData
): Promise<ActivityLogEntry[] | undefined> => {
  const queryResult: ActivityLogEntry[] = [];
  const { TABLE_NAME } = process.env;
  let lastEvaluatedKey: Record<string, unknown> | undefined;
  const command = {
    TableName: TABLE_NAME,
    KeyConditionExpression: "user_id = :user_id",
    ExpressionAttributeValues: {
      ":user_id": userData.user_id,
    },
    ScanIndexForward: true,
    ExclusiveStartKey: lastEvaluatedKey,
  };

  do {
    // eslint-disable-next-line no-await-in-loop
    const response = await dynamoDocClient.send(new QueryCommand(command));

    if (response.Items) {
      queryResult.push(...(response.Items as ActivityLogEntry[]));
    }

    lastEvaluatedKey = response.LastEvaluatedKey
      ? response.LastEvaluatedKey
      : undefined;
  } while (lastEvaluatedKey);

  return queryResult.length > 0 ? queryResult : undefined;
};

const splitArrayIntoBatchesOf25 = (
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

const newDeleteRequest = (
  activityLogEntry: ActivityLogEntry
) => ({
  DeleteRequest: {
    Key: {
      user_id: { S: activityLogEntry.user_id },
      timestamp: { N: activityLogEntry.timestamp.toString() },
    },
  },
});

export const batchDeletionRequestArray = (
  activityLogEntries: ActivityLogEntry[]
): WriteRequest[][] => {
  return splitArrayIntoBatchesOf25(
    activityLogEntries.map((entry) => (
      newDeleteRequest(entry)
    ))
  );
};

export const batchDeleteActivityLog = async (
  activityLogEntries: ActivityLogEntry[]
) => {
  const batchArray = batchDeletionRequestArray(activityLogEntries);
  Promise.all(
    batchArray.map(async (arrayOf25orFewerItems) => {
      try {
        const batchcommand = new BatchWriteItemCommand({
          RequestItems: {
            activity_logs: arrayOf25orFewerItems,
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
