import { SNSEvent } from "aws-lambda";
import { UserData } from "./common/model";
import { getEnvironmentVariable } from "./common/utils";

const GOV_ACCOUNTS_PUBLISHING_API_TOKEN = getEnvironmentVariable(
  "GOV_ACCOUNTS_PUBLISHING_API_TOKEN"
);
const GOV_ACCOUNTS_PUBLISHING_API_URL = getEnvironmentVariable(
  "GOV_ACCOUNTS_PUBLISHING_API_URL"
);

const requestConfig: RequestInit = {
  headers: {
    Authorization: `Bearer ${GOV_ACCOUNTS_PUBLISHING_API_TOKEN}`,
  },
  method: "DELETE",
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

const getDeleteUrl = (userData: UserData) => {
  return `${GOV_ACCOUNTS_PUBLISHING_API_URL}${getPath(userData)}`;
};

export const deleteEmailSubscription = async (
  userData: UserData
): Promise<void> => {
  const deleteUrl = getDeleteUrl(userData);
  const response = await fetch(deleteUrl, requestConfig);
  if (response.status !== 404 && !response.ok) {
    throw new Error(
      `Unable to send DELETE request to GOV.UK API. Status code: ${response.status}`
    );
  }
};

export const handler = async (event: SNSEvent): Promise<void> => {
  await Promise.all(
    event.Records.map(async (record) => {
      try {
        const userData: UserData = JSON.parse(record.Sns.Message);
        validateUserData(userData);
        await deleteEmailSubscription(userData);
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
