import { SNSEvent } from "aws-lambda";
import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";
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

async function sendRequestWithAxios(snsMessage: SNSMessage) {
  console.log(`Sending DELETE request with axios.`);

  const interceptor = aws4Interceptor({
    region: "eu-west-2",
    service: "execute-api",
  });

  axios.interceptors.request.use(interceptor);
  const token: string = process.env.GOV_ACCOUNTS_PUBLISHING_API_TOKEN!;
  const requestConfig = getRequestConfig(token);

  console.log("Request config:", requestConfig);

  let deleteUrl = `account-api.staging.publishing.service.gov.uk/api/oidc-users/${snsMessage.publicSubjectId}`;
  if (snsMessage.legacySubjectId) {
    deleteUrl = `${deleteUrl}?legacy_sub=${snsMessage.legacySubjectId}`;
  }

  let responseObject;
  try {
    const response: AxiosResponse = await axios.delete(
      deleteUrl,
      // "https://w91dhcuqij.execute-api.eu-west-2.amazonaws.com/dev/api/oidc-users/ana-test-user",
      requestConfig
    );

    responseObject = {
      status: response.status,
      statusText: response.statusText,
    };
  } catch (error: any | AxiosError) {
    console.log(error);
    if (axios.isAxiosError(error)) {
      responseObject = {
        message: error.message,
        name: error.name,
        status: error.status,
      };
    }
  }
  console.log("Done. Returning the response:", responseObject);
  return responseObject;
}

export const handler = async (event: SNSEvent): Promise<void> => {
  console.log("SNS Event: ", JSON.stringify(event));

  await Promise.all(
    event.Records.map(async (record) => {
      try {
        const snsMessage: SNSMessage = JSON.parse(record.Sns.Message);
        console.log("Parsed snsMessage:", snsMessage);
        await sendRequestWithAxios(snsMessage);
      } catch (err) {
        console.error(err);
      }
    })
  );
};
