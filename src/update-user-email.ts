import { Context, DynamoDBStreamEvent, DynamoDBRecord } from "aws-lambda";
import { AttributeValue, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { TxmaEvent } from "./common/model.js";
import { getEnvironmentVariable } from "./common/utils.js";
import { Logger } from "@aws-lambda-powertools/logger";

const logger = new Logger();
const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(dynamoClient);

const handleRecord = async (record: DynamoDBRecord, tableName: string): Promise<void> => {
  const txmaEvent = unmarshall(
    record.dynamodb?.NewImage?.event.M as Record<string, AttributeValue>
  ) as TxmaEvent;

  const userId = txmaEvent.user?.user_id;
  if (!userId) {
    throw new Error("user_id is missing from the event");
  }

  const newEmail = txmaEvent.user?.email;
  if (!newEmail) {
    throw new Error("email is missing from the event");
  }

  logger.info("Processing email update event", {
    userId,
    eventName: txmaEvent.event_name,
  });

  const queryResponse = await dynamoDocClient.send(
    new QueryCommand({
      IndexName: "CommonSubjectIdIndex",
      TableName: tableName,
      KeyConditionExpression: "commonSubjectId = :uid",
      ExpressionAttributeValues: { ":uid": userId },
    })
  );

  if (!queryResponse.Items || queryResponse.Items.length === 0) {
    logger.warn("No inactive account tracker record found for user", { userId });
    return;
  }

  const trackerRecord = queryResponse.Items[0];

  const eventDateTime = new Date(txmaEvent.event_timestamp_ms ?? (txmaEvent.timestamp * 1000)).toISOString();

  try {
    await dynamoDocClient.send(
      new UpdateCommand({
        TableName: tableName,
        Key: {
          dateForDeletion: trackerRecord.dateForDeletion,
          commonSubjectId: userId,
        },
        UpdateExpression:
          "SET emailAddress = :email, emailAddressSource = :source, emailAddressLastUpdated = :lastUpdated" +
          (txmaEvent.event_id ? ", emailAddressSourceId = :sourceId" : ""),
        ConditionExpression:
          "attribute_not_exists(emailAddressLastUpdated) OR emailAddressLastUpdated < :lastUpdated",
        ExpressionAttributeValues: {
          ":email": newEmail,
          ":source": txmaEvent.event_name,
          ":lastUpdated": eventDateTime,
          ...(txmaEvent.event_id && { ":sourceId": txmaEvent.event_id }),
        },
      })
    );
    logger.info("Successfully updated email address in inactive account tracker", { userId });
  } catch (error) {
    const err = error as Error;
    if (err.name === "ConditionalCheckFailedException") {
      logger.warn("An email update event with a newer timestamp has already been processed.", {
        userId,
        incomingTimestamp: eventDateTime,
      });
    } else {
      throw err;
    }
  }
}

export const handler = async (
  event: DynamoDBStreamEvent,
  context: Context
): Promise<void> => {
  logger.addContext(context);

  const tableName = getEnvironmentVariable("INACTIVE_ACCOUNT_TRACKER_TABLE_NAME");

  for (const record of event.Records) {
    await handleRecord(record, tableName);
  }
};
