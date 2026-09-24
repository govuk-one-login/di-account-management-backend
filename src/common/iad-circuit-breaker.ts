import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { getEnvironmentVariable } from "./utils.js";
import * as v from "valibot";

const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(dynamoClient);

const pk = "IAD";

const circuitBreakerSchema = v.optional(
  v.array(
    v.object({
      pk: v.literal(pk),
      datetime: v.number(),
      enabled: v.boolean(),
      metadataJson: v.optional(v.pipe(v.string(), v.parseJson())),
    })
  )
);

export const getIadCircuitBreakerStatus = async () => {
  const tableName = getEnvironmentVariable(
    "INACTIVE_ACCOUNT_CIRCUIT_BREAKER_TABLE_NAME"
  );

  const result = await dynamoDocClient.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": pk },
      ScanIndexForward: false,
      Limit: 1,
      ConsistentRead: true,
    })
  );

  const latest = v.parse(circuitBreakerSchema, result.Items);

  return latest?.[0]?.enabled ?? false;
};

export const disableIad = async (metadata: unknown) => {
  const tableName = getEnvironmentVariable(
    "INACTIVE_ACCOUNT_CIRCUIT_BREAKER_TABLE_NAME"
  );

  await dynamoDocClient.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        pk,
        datetime: Date.now(),
        enabled: false,
        metadataJson: JSON.stringify(metadata),
      },
    })
  );
};
