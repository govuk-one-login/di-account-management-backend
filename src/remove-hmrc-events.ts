import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  BatchWriteCommand,
  ScanCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { getEnvironmentVariable } from "./common/utils";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (): Promise<unknown> => {
  const TABLE_NAME = getEnvironmentVariable("TABLE_NAME");
  let lastEvaluatedKey: Record<string, unknown> | undefined = undefined;

  try {
    do {
      const scanParams: ScanCommandInput = {
        TableName: TABLE_NAME,
        FilterExpression: "NOT begins_with(user_id, :urn)",
        ExpressionAttributeValues: {
          ":urn": "urn:",
        },
        ExclusiveStartKey: lastEvaluatedKey,
      };

      const scanResults = await docClient.send(new ScanCommand(scanParams));
      console.log("Scan complete");

      const itemsToDelete = scanResults.Items || [];

      if (itemsToDelete.length > 0) {
        for (let i = 0; i < itemsToDelete.length; i += 25) {
          const batchDeleteRequests = itemsToDelete
            .slice(i, i + 25)
            .map((item) => ({
              DeleteRequest: {
                Key: {
                  user_id: item["user_id"],
                },
              },
            }));

          const batchWriteParams = {
            RequestItems: {
              [TABLE_NAME]: batchDeleteRequests,
            },
          };

          await docClient.send(new BatchWriteCommand(batchWriteParams));
          console.log(
            `Deleted ${batchDeleteRequests.length} items from DynamoDB table.`
          );
        }
      }

      lastEvaluatedKey = scanResults.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    console.log("Scan and delete process completed.");
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
