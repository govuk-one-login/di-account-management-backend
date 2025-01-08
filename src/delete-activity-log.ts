import { SNSEvent } from "aws-lambda";
import {
  DynamoDBClient,
  BatchWriteItemCommand,
  WriteRequest,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ActivityLogEntry, UserData } from "./common/model";
import { getEnvironmentVariable } from "./common/utils";

const TABLE_NAME = getEnvironmentVariable("TABLE_NAME");

const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: { convertClassInstanceToMap: true },
});

export const validateUserData = (userData: UserData): UserData => {
  if (userData.user_id) {
    return userData;
  }
  throw new Error(`userData did not have a user_id`);
};

export const getAllActivityLogEntriesForUser = async (
  userData: UserData
): Promise<ActivityLogEntry[] | undefined> => {
  const queryResult: ActivityLogEntry[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;
  do {
    const command = new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "user_id = :user_id",
      ExpressionAttributeValues: {
        ":user_id": userData.user_id,
      },
      ScanIndexForward: true,
      ExclusiveStartKey: lastEvaluatedKey,
    });

    const response = await dynamoDocClient.send(command);
    if (response.Items) {
      queryResult.push(...(response.Items as ActivityLogEntry[]));
    }
    lastEvaluatedKey = response.LastEvaluatedKey;
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

const newDeleteRequest = (activityLogEntry: ActivityLogEntry) => ({
  DeleteRequest: {
    Key: {
      user_id: { S: activityLogEntry.user_id },
      event_id: { S: activityLogEntry.event_id },
    },
  },
});

export const buildBatchDeletionRequestArray = (
  activityLogEntries: ActivityLogEntry[]
): WriteRequest[][] => {
  return splitArrayIntoBatchesOf25(
    activityLogEntries.map((entry) => newDeleteRequest(entry))
  );
};

export const batchDeleteActivityLog = async (
  activityLogEntries: ActivityLogEntry[]
) => {
  const batches = buildBatchDeletionRequestArray(activityLogEntries);

  await Promise.all(
    batches.map(async (batch) => {
      try {
        const batchCommand = new BatchWriteItemCommand({
          RequestItems: {
            [TABLE_NAME]: batch,
          },
        });
        await dynamoDocClient.send(batchCommand);
      } catch (error) {
        console.error("Error occurred during batch delete:", error);
        throw error;
      }
    })
  );
};

export const handler = async (event: SNSEvent): Promise<void> => {
  await Promise.all(
    event.Records.map(async (record) => {
      try {
        const userData: UserData = JSON.parse(record.Sns.Message);
        validateUserData(userData);
        const activityLogEntries =
          await getAllActivityLogEntriesForUser(userData);
        if (activityLogEntries) {
          await batchDeleteActivityLog(activityLogEntries);
        }
      } catch (error) {
        throw new Error(
          `Unable to delete activity log for message with ID: ${record.Sns.MessageId}, ${
            (error as Error).message
          }`
        );
      }
    })
  );
};
