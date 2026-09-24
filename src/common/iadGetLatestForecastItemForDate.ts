import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getEnvironmentVariable } from "./utils.js";

const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(dynamoClient);

interface InactiveAccountDailyDeletionForecastRecord {
  dateForDeletion: string;
  forecastedAt: string;
  accountsToDelete: number;
  ttl: number;
  iadQueryLogicHash: {
    hash: string;
    algorithm: string;
    generatedAt: string;
  };
}

export const getLatestForecastItemForDate = async (
  dateForDeletion: string
): Promise<InactiveAccountDailyDeletionForecastRecord | undefined> => {
  const response = await dynamoDocClient.send(
    new QueryCommand({
      TableName: getEnvironmentVariable("FORECAST_TABLE_NAME"),
      KeyConditionExpression: "dateForDeletion = :date",
      ExpressionAttributeValues: { ":date": dateForDeletion },
      ScanIndexForward: false,
      Limit: 1,
    })
  );
  return response.Items?.[0] as
    InactiveAccountDailyDeletionForecastRecord | undefined;
};
