import { APIGatewayProxyHandler } from "./common/types.js";
import { normalizeAPIGatewayProxyEventHandlerWrapper } from "./common/normalizeAPIGatewayProxyEventHandlerWrapper.js";
import {
  initMetrics,
  metricsAPIGatewayProxyHandlerWrapper,
} from "./common/metrics.js";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";

const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(dynamoClient);

const metrics = initMetrics("stub-api-handler");

export const handler: APIGatewayProxyHandler =
  normalizeAPIGatewayProxyEventHandlerWrapper(
    metricsAPIGatewayProxyHandlerWrapper(metrics, async (event) => {
      const now = Math.floor(Date.now() / 1000);

      await dynamoDocClient.send(
        new PutCommand({
          TableName: process.env.STUB_API_OUTPUTS_TABLE_NAME,
          Item: {
            id: randomUUID(),
            allItemsId: "an_item",
            createdAt: now,
            expiresAt: now + 86400,
            event,
          },
        })
      );
      return {
        statusCode: 200,
        body: "",
      };
    })
  );
