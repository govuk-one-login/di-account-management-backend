import { SNSEvent } from "aws-lambda";
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { aws4Interceptor } from "aws4-axios";
import { SNSMessage } from "./models";

export function getRequestConfig(
  accessToken: string,
  sourceIp?: string,
  persistentSessionId?: string,
  sessionId?: string
): AxiosRequestConfig {
  const config: AxiosRequestConfig = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    proxy: false,
  };

  if (sourceIp) {
    config.headers!["X-Forwarded-For"] = sourceIp;
  }

  if (persistentSessionId) {
    config.headers!["di-persistent-session-id"] = persistentSessionId;
  }

  if (sessionId) {
    config.headers!["Session-Id"] = sessionId;
  }
  return config;
}

export const validateSNSMessage = (snsMessage: SNSMessage): SNSMessage => {
  if (!snsMessage.email || !snsMessage.access_token) {
    throw new Error(
      `SNS Message is missing one or both of the required attributes "email" and "access_token". ${JSON.stringify(
        snsMessage
      )}`
    );
  }
  return snsMessage;
};

export async function sendRequest(snsMessage: SNSMessage) {
  console.log("Sending POST request to Auth HTTP API.");

  const interceptor = aws4Interceptor({
    region: "eu-west-2",
    service: "execute-api",
  });

  axios.interceptors.request.use(interceptor);

  const requestConfig = getRequestConfig(
    snsMessage.access_token,
    snsMessage.source_ip,
    snsMessage.persistent_session_id,
    snsMessage.session_id
  );
  const deleteUrl = `${process.env.MOCK_PUBLISHING_API_URL}/delete-account`;
  // const deleteUrl = "https://home.dev.account.gov.uk/delete-account";

  console.log(
    `Request config: ${JSON.stringify(requestConfig)}, URL: ${deleteUrl}`
  );

  try {
    const response: AxiosResponse = await axios.post(
      deleteUrl,
      { email: snsMessage.email },
      requestConfig
    );

    const responseObject = {
      status: response.status,
      statusText: response.statusText,
      data: response.data,
    };

    console.log(`Response from Auth API: ${JSON.stringify(responseObject)}`);

    return responseObject;
  } catch (error: any) {
    console.log(
      `Unable to successfully send POST request to Auth HTTP API. Error:${error}`
    );
    throw Error(error);
  }
}

export const handler = async (event: SNSEvent): Promise<void> => {
  console.log(`SNS Event received: ${JSON.stringify(event)}`);

  await Promise.all(
    event.Records.map(async (record) => {
      const snsMessage: SNSMessage = JSON.parse(record.Sns.Message);
      console.log(`Parsed SNS Message: ${JSON.stringify(snsMessage)}`);
      validateSNSMessage(snsMessage);
      await sendRequest(snsMessage);
    })
  );
};
