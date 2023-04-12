import { SNSEvent } from "aws-lambda";
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import {
  SQSClient,
  SendMessageRequest,
  SendMessageCommand,
} from "@aws-sdk/client-sqs";
import { UserData } from "./models";

const sqsClient = new SQSClient({});

export function getRequestConfig(
  token: string | undefined
): AxiosRequestConfig {
  const config: AxiosRequestConfig = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    proxy: false,
  };
  return config;
}

export const validateUserData = (userData: UserData): UserData => {
  if (
    !(
      userData.user_id !== undefined && userData.public_subject_id !== undefined
    )
  ) {
    throw new Error(`userData is not valid : ${JSON.stringify(userData)}`);
  }
  return userData;
};

function getRequestUrl(
  publishingUrl: string | undefined,
  publicSubjectId: string
) {
  return `${publishingUrl}/api/oidc-users/${publicSubjectId}`;
}

export const deleteEmailSubscription = async (userData: UserData) => {
  const { GOV_ACCOUNTS_PUBLISHING_API_TOKEN, GOV_ACCOUNTS_PUBLISHING_API_URL } =
    process.env;
  console.log("Sending DELETE request to GOV.UK Subscriptions API.");
  const requestConfig = getRequestConfig(GOV_ACCOUNTS_PUBLISHING_API_TOKEN);

  let deleteUrl = getRequestUrl(
    GOV_ACCOUNTS_PUBLISHING_API_URL,
    userData.public_subject_id
  );

  if (userData.legacy_subject_id) {
    deleteUrl = `${deleteUrl}?legacy_sub=${userData.legacy_subject_id}`;
  }

  console.log(
    `Request config: ${JSON.stringify(requestConfig)}, URL: ${deleteUrl}`
  );

  try {
    const response: AxiosResponse = await axios.delete(
      deleteUrl,
      requestConfig
    );

    const responseObject = {
      status: response.status,
      statusText: response.statusText,
    };

    console.log(`Response from GOV.UK API: ${JSON.stringify(responseObject)}`);

    return responseObject;
  } catch (error: any) {
    console.error(
      `Unable to send DELETE request to GOV.UK API. Error:${error}`
    );
    throw Error(error);
  }
};

export const handler = async (event: SNSEvent): Promise<void> => {
  const { DLQ_URL } = process.env;

  await Promise.all(
    event.Records.map(async (record) => {
      try {
        const userData: UserData = JSON.parse(record.Sns.Message);
        validateUserData(userData);
        await deleteEmailSubscription(userData);
      } catch (err) {
        console.error(err);
        const message: SendMessageRequest = {
          QueueUrl: DLQ_URL,
          MessageBody: record.Sns.Message,
        };
        await sqsClient.send(new SendMessageCommand(message));
      }
    })
  );
};
