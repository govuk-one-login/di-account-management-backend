import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { aws4Interceptor } from "aws4-axios";
import { Payload } from "./models";

export function getRequestConfig(token: string): AxiosRequestConfig {
  const config: AxiosRequestConfig = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    proxy: false,
  };
  return config;
}

export const validatePayload = (payload: Payload): Payload => {
  if (!payload.public_subject_id) {
    throw new Error(
      `Payload is missing required attribute "public_subject_id". ${JSON.stringify(
        payload
      )}`
    );
  }
  return payload;
};

async function sendRequest(payload: Payload) {
  console.log("Sending DELETE request to GOV.UK Subscriptions API.");

  const interceptor = aws4Interceptor({
    region: "eu-west-2",
    service: "execute-api",
  });

  axios.interceptors.request.use(interceptor);

  const token: string = process.env.GOV_ACCOUNTS_PUBLISHING_API_TOKEN!;
  const requestConfig = getRequestConfig(token);
  let deleteUrl = `${process.env.MOCK_PUBLISHING_API_URL}/api/oidc-users/${payload.public_subject_id}`;
  // let deleteUrl = `account-api.staging.publishing.service.gov.uk/api/oidc-users/${snsMessage.public_subject_id}`;
  if (payload.legacy_subject_id) {
    deleteUrl = `${deleteUrl}?legacy_sub=${payload.legacy_subject_id}`;
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

    console.log(`Response: ${JSON.stringify(responseObject)}`);

    return responseObject;
  } catch (error) {
    console.log(
      `Unable to successfully send DELETE request to GOV.UK. Error:${error}`
    );
  }
  return undefined;
}

export const handler = async (event: {
  Payload: Payload;
  FunctionName: string;
}): Promise<void> => {
  console.log(`Input event received: ${JSON.stringify(event)}`);
  try {
    const payload = event.Payload;
    console.log(`Payload: ${JSON.stringify(payload)}`);
    validatePayload(payload);
    await sendRequest(payload);
  } catch (error) {
    console.error(error);
  }
};
