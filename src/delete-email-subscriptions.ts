import { SNSEvent } from "aws-lambda";
import { UserData } from "./common/model";
import { sendSqsMessage } from "./common/sqs";

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
  const { GOV_ACCOUNTS_PUBLISHING_API_TOKEN, GOV_ACCOUNTS_PUBLISHING_API_URL } =
    process.env;
  const deleteUrl = getDeleteUrl(GOV_ACCOUNTS_PUBLISHING_API_URL, userData);
  const config = getRequestConfig(GOV_ACCOUNTS_PUBLISHING_API_TOKEN);

  const response = await fetch(deleteUrl, config);
  if (response.status === 404) {
    // We are logging a 404 as is an appropriate reponse when the user does not have an email subscription .
    console.log(`Received a 404 response from GOV.UK API for URL`);
  } else if (!response.ok) {
    const message = `Unable to send DELETE request to GOV.UK API. Status code : ${response.status}`;
    throw new Error(message);
  }
};

export const handler = async (event: SNSEvent): Promise<void> => {
  const { DLQ_URL } = process.env;
  await Promise.all(
    event.Records.map(async (record) => {
      try {
        console.log(
          `started processing message with ID: ${record.Sns.MessageId}`
        );
        if (!DLQ_URL) {
          throw new Error("DLQ_URL environment variable is not set");
        }
        const userData: UserData = JSON.parse(record.Sns.Message);
        validateUserData(userData);
        await deleteEmailSubscription(userData);
        console.log(
          `finished processing message with ID: ${record.Sns.MessageId}`
        );
      } catch (error) {
        console.error(`[Error occurred]: ${(error as Error).message}`);
        try {
          const result = await sendSqsMessage(record.Sns.Message, DLQ_URL);
          console.error(
            `[Message sent to DLQ] with message id = ${result.MessageId}`
          );
        } catch (dlqError) {
          console.error(`Failed to send message to DLQ: `, dlqError);
        }
      }
    })
  );
};
