import { Context, SNSEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { UserData } from "./common/model.js";
import { getEnvironmentVariable } from "./common/utils.js";
import { Logger } from "@aws-lambda-powertools/logger";
import { sendSqsMessage } from "./common/sqs.js";
import { isUserIdBlocked } from "./common/account-interventions-service-client.js";

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
): Promise<{ deleted: boolean; emailAddress?: string; hasUndeliverableEmailAddress?: boolean }> => {
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
    return { deleted: false };
  }

  const item = queryResponse.Items[0];

  await Promise.all(
    queryResponse.Items.map((i) =>
      dynamoDocClient.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: {
            dateForDeletion: i.dateForDeletion,
            commonSubjectId: i.commonSubjectId,
          },
        })
      )
    )
  );

  return {
    deleted: true,
    emailAddress: item.emailAddress,
    hasUndeliverableEmailAddress: item.hasUndeliverableEmailAddress,
  };
};

export const maybeEnqueueDeletionEmail = async (
  userId: string,
  emailAddress: string | undefined,
  hasUndeliverableEmailAddress: boolean | undefined
): Promise<void> => {
  if (!emailAddress) {
    logger.info("Skipping IAD deletion email: no email address");
    return;
  }

  if (hasUndeliverableEmailAddress) {
    logger.info("Skipping IAD deletion email: user has undeliverable email address");
    return;
  }

  if (await isUserIdBlocked(userId)) {
    logger.info("Skipping IAD deletion email: user is blocked");
    return;
  }

  const notificationQueueUrl = getEnvironmentVariable("NOTIFICATION_QUEUE_URL");
  await sendSqsMessage(
    JSON.stringify({
      notificationType: "INACTIVE_ACCOUNT_DELETED_CONFIRMATION",
      emailAddress,
    }),
    notificationQueueUrl
  );

  logger.info("Enqueued IAD deletion confirmation email");
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
        const result = await deleteUserData(userData);

        const accountDeletionReason =
          record.Sns.MessageAttributes?.account_deletion_reason?.Value;

        if (
          result.deleted &&
          accountDeletionReason === "INACTIVE_ACCOUNT"
        ) {
          await maybeEnqueueDeletionEmail(
            userData.user_id,
            result.emailAddress,
            result.hasUndeliverableEmailAddress
          );
        }

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
