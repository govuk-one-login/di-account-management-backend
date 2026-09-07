import { Context, SNSEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { UserData } from "./common/model.js";
import { getEnvironmentVariable } from "./common/utils.js";
import { sendAuditEvent } from "./common/send-audit-event.js";
import { Logger } from "@aws-lambda-powertools/logger";

const logger = new Logger();

const marshallOptions = {
  convertClassInstanceToMap: true,
};
const translateConfig = { marshallOptions };

const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(
  dynamoClient,
  translateConfig
);

export const validateUserData = (userData: UserData): UserData => {
  if (userData.user_id) {
    return userData;
  }
  throw new Error(
    `userData did not have a user_id: ${JSON.stringify(userData)}`
  );
};

export const deleteUserData = async (
  userData: UserData
): Promise<void> => {
  const TABLE_NAME = getEnvironmentVariable("TABLE_NAME");

  const queryResponse = await dynamoDocClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "CommonSubjectIdIndex",
      KeyConditionExpression: "commonSubjectId = :uid",
      ExpressionAttributeValues: { ":uid": userData.user_id },
    })
  );

  if (!queryResponse.Items || queryResponse.Items.length === 0) {
    logger.info("no inactive account tracker records found for user");
    return;
  }

  await Promise.all(
    queryResponse.Items.map(async (item) => {
      await dynamoDocClient.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: {
            dateForDeletion: item.dateForDeletion,
            commonSubjectId: item.commonSubjectId,
          },
        })
      );

      // Emit one audit event per deleted tracker record so TxMA has a record of
      // the deletion. The extension carries the deleted record's deletion date.
      await sendAuditEvent("HOME_ACCOUNT_TRACKER_RECORD_DELETED", {
        user: {
          user_id: item.commonSubjectId,
        },
        extensions: {
          accountTrackerAccountDeletionDate: item.dateForDeletion,
        },
      });
    })
  );
};

export const handler = async (
  event: SNSEvent,
  context: Context
): Promise<void> => {
  logger.addContext(context);
  await Promise.all(
    event.Records.map(async (record) => {
      try {
        logger.info(
          `started processing message with ID: ${record.Sns.MessageId}`
        );
        const userData: UserData = JSON.parse(record.Sns.Message);
        validateUserData(userData);
        await deleteUserData(userData);
        logger.info(
          `finished processing message with ID: ${record.Sns.MessageId}`
        );
      } catch (error) {
        throw new Error(
          `Unable to delete inactive account tracker data for message with ID: ${record.Sns.MessageId}, ${
            (error as Error).message
          }`, { cause: error }
        );
      }
    })
  );
};
