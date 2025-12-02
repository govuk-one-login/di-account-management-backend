import { Context, SNSEvent } from "aws-lambda";
import { UserData } from "./common/model";
import { getEnvironmentVariable } from "./common/utils";
import { Logger } from "@aws-lambda-powertools/logger";

const logger = new Logger();

export const getRequestConfig = (token: string | undefined) => {
  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    method: "DELETE",
  };
  return config;
};

export const validateUserData = (userData: UserData): UserData => {
  if (
    !(
      userData.user_id !== undefined && userData.public_subject_id !== undefined
    )
  ) {
    throw new Error(`userData is not valid`);
  }
  return userData;
};

const getPath = (userData: UserData) => {
  if (userData.legacy_subject_id) {
    return `/api/oidc-users/${userData.public_subject_id}/?legacy_sub=${userData.legacy_subject_id}`;
  }
  return `/api/oidc-users/${userData.public_subject_id}`;
};

const getDeleteUrl = (
  publishingUrl: string | undefined,
  userData: UserData
) => {
  return publishingUrl + getPath(userData);
};

export const deleteEmailSubscription = async (userData: UserData) => {
  // We are storing the api token in the environment variables to avoid repeated calls to secrets manager possibly limiting lambda start times and it is infrequently changed.
  const GOV_ACCOUNTS_PUBLISHING_API_TOKEN = getEnvironmentVariable(
    "GOV_ACCOUNTS_PUBLISHING_API_TOKEN"
  );
  const GOV_ACCOUNTS_PUBLISHING_API_URL = getEnvironmentVariable(
    "GOV_ACCOUNTS_PUBLISHING_API_URL"
  );
  const deleteUrl = getDeleteUrl(GOV_ACCOUNTS_PUBLISHING_API_URL, userData);
  const config = getRequestConfig(GOV_ACCOUNTS_PUBLISHING_API_TOKEN);

  const response = await fetch(deleteUrl, config);
  if (response.status === 404) {
    // We are logging a 404 as is an appropriate reponse when the user does not have an email subscription .
    logger.info(`Received a 404 response from GOV.UK API for URL`);
  } else if (!response.ok) {
    const message = `Unable to send DELETE request to GOV.UK API. Status code : ${response.status}`;
    logger.error(message);
    throw new Error(message);
  }
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
        await deleteEmailSubscription(userData);
        logger.info(
          `finished processing message with ID: ${record.Sns.MessageId}`
        );
      } catch (error) {
        throw new Error(
          `Unable to delete activity log for message with ID: ${record.Sns.MessageId}, ${
            (error as Error).message
          }`
        );
      }
    })
  );
};
