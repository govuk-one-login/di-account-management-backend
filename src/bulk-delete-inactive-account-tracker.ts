import { Context } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { Logger } from "@aws-lambda-powertools/logger";
import { getEnvironmentVariable } from "./common/utils.js";

const logger = new Logger();
const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(dynamoClient);

export interface BulkDeleteEvent {
  startKey?: Record<string, unknown>;
}

export interface BulkDeleteResult {
  deleted: number;
  lastEvaluatedKey?: Record<string, unknown>;
}

export const handler = async (
  event: BulkDeleteEvent,
  context: Context
): Promise<BulkDeleteResult> => {
  logger.addContext(context);

  const tableName = getEnvironmentVariable("TABLE_NAME");
  let lastEvaluatedKey: Record<string, unknown> | undefined =
    event.startKey ?? undefined;
  let deleted = 0;

  do {
    const scanResponse = await dynamoDocClient.send(
      new ScanCommand({
        TableName: tableName,
        ProjectionExpression: "dateForDeletion, commonSubjectId",
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: 25,
      })
    );

    const items = scanResponse.Items ?? [];

    if (items.length > 0) {
      await dynamoDocClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [tableName]: items.map((item) => ({
              DeleteRequest: {
                Key: {
                  dateForDeletion: item.dateForDeletion,
                  commonSubjectId: item.commonSubjectId,
                },
              },
            })),
          },
        })
      );
      deleted += items.length;
    }

    lastEvaluatedKey = scanResponse.LastEvaluatedKey ?? undefined;

    if (context.getRemainingTimeInMillis() < 10_000) {
      logger.info(`Approaching timeout, stopping. Deleted ${deleted} items.`);
      break;
    }
  } while (lastEvaluatedKey);

  if (lastEvaluatedKey) {
    logger.info(
      `Invocation complete but rows still remain. Deleted ${deleted} items this run. ` +
      `Re-invoke with: { "startKey": { "dateForDeletion": "${lastEvaluatedKey.dateForDeletion}", "commonSubjectId": "${lastEvaluatedKey.commonSubjectId}" } }`
    );
  } else {
    logger.info(`All rows deleted. Deleted ${deleted} items this run. The table is now empty.`);
  }

  return { deleted, lastEvaluatedKey };
};
