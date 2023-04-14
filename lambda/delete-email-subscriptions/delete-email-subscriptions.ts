import { SNSEvent } from "aws-lambda";
import https, { RequestOptions } from "https";
import {
  SQSClient,
  SendMessageRequest,
  SendMessageCommand,
} from "@aws-sdk/client-sqs";
import { UserData } from "./models";

const sqsClient = new SQSClient({});

export function getRequestConfig(
  token: string | undefined,
  publishingUrl: string | undefined,
  path: string
): RequestOptions {
  const config: RequestOptions = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    method: "DELETE",
    hostname: publishingUrl,
    port: 443,
    path,
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
function getPath(userData: UserData) {
  if (userData.legacy_subject_id) {
    return `/api/oidc-users/${userData.public_subject_id}/?legacy_sub=${userData.legacy_subject_id}`;
  }
  return `/api/oidc-users/${userData.public_subject_id}`;
}

export const deleteEmailSubscription = async (userData: UserData) => {
  const { GOV_ACCOUNTS_PUBLISHING_API_TOKEN, GOV_ACCOUNTS_PUBLISHING_API_URL } =
    process.env;
  console.log("Sending DELETE request to GOV.UK Subscriptions API.");

  const requestConfig = getRequestConfig(
    GOV_ACCOUNTS_PUBLISHING_API_TOKEN,
    GOV_ACCOUNTS_PUBLISHING_API_URL,
    getPath(userData)
  );

  console.log(`Request config: ${JSON.stringify(requestConfig)}`);

  try {
    https.request(requestConfig, (response: any) => {
      console.log(`Response from GOV.UK API: ${JSON.stringify(response)}`);
      console.log(`statusCode: ${response.statusCode}`);
    });
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
