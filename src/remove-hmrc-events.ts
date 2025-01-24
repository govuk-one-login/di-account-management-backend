import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "user_services";

export const handler = async (): Promise<unknown> => {
  try {
    const scanParams = {
      TableName: TABLE_NAME,
      FilterExpression: "NOT begins_with(user_id, :urn)",
      ExpressionAttributeValues: {
        ":urn": "urn:",
      },
    };

    const scanResults = await docClient.send(new ScanCommand(scanParams));
    const itemsToDelete = scanResults.Items || [];

    if (itemsToDelete.length > 0) {
      const deleteRequests = itemsToDelete.map((item) => ({
        DeleteRequest: {
          Key: {
            user_id: item["user_id"],
          },
        },
      }));

      const batchWriteParams = {
        RequestItems: {
          [TABLE_NAME]: deleteRequests,
        },
      };

      await docClient.send(new BatchWriteCommand(batchWriteParams));
      console.log(`Deleted ${itemsToDelete.length} items from DynamoDB table.`);
    } else {
      console.log("No items found matching the criteria.");
    }

    return {
      statusCode: 200,
      body: "Scan and delete process completed.",
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: "An error occurred during the process.",
    };
  }
};
