import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { getEnvironmentVariable } from "../utils.js";

const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(dynamoClient);

export const getNumberOfAccountsForecastForDeletion = async (
  date: string
): Promise<number | undefined> => {
  const result = await dynamoDocClient.send(
    new GetCommand({
      TableName: getEnvironmentVariable("FORECAST_TABLE_NAME"),
      Key: { dateForDeletion: date },
      ConsistentRead: true,
    })
  );
  return result.Item?.accountsToDelete as number | undefined;
};
