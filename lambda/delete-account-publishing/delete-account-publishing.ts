import { SNSEvent } from "aws-lambda";
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { aws4Interceptor } from "aws4-axios";
import { SNSMessage } from "./models";

export function getRequestConfig(token: string): AxiosRequestConfig {
  const config: AxiosRequestConfig = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    proxy: false,
  };
  return config;
}

async function sendRequest(snsMessage: SNSMessage) {
  console.log("Sending DELETE request to GOV.UK.");

  const interceptor = aws4Interceptor({
    region: "eu-west-2",
    service: "execute-api",
  });

  axios.interceptors.request.use(interceptor);

  const token: string = process.env.GOV_ACCOUNTS_PUBLISHING_API_TOKEN!;
  const requestConfig = getRequestConfig(token);
  let deleteUrl = `${process.env.MOCK_PUBLISHING_API_URL}/api/oidc-users/${snsMessage.publicSubjectId}`;
  // let deleteUrl = `account-api.staging.publishing.service.gov.uk/api/oidc-users/${snsMessage.publicSubjectId}`;
  if (snsMessage.legacySubjectId) {
    deleteUrl = `${deleteUrl}?legacy_sub=${snsMessage.legacySubjectId}`;
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

    console.log(`Response: ${responseObject}`);

    return responseObject;
  } catch (error) {
    console.log(
      `Unable to send delete account request to GOV.UK. Error:${error}`
    );
  }
  return undefined;
}

export const handler = async (event: SNSEvent): Promise<void> => {
  console.log(`SNS Event: ${JSON.stringify(event)}`);

  await Promise.all(
    event.Records.map(async (record) => {
      try {
        const snsMessage: SNSMessage = JSON.parse(record.Sns.Message);
        console.log(`Parsed SNS Message: ${JSON.stringify(snsMessage)}`);
        await sendRequest(snsMessage);
      } catch (error) {
        console.error(error);
      }
    })
  );
};
