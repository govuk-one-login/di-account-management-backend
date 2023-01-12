import { SNSEvent } from "aws-lambda";
import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";
import { aws4Interceptor } from "aws4-axios";
import { SNSMessage } from "./models";

export function getRequestConfig(
  token: string,
  validationStatues?: number[] | null,
  sourceIp?: string,
  persistentSessionId?: string,
  sessionId?: string,
  userLanguage?: string
): AxiosRequestConfig {
  const config: AxiosRequestConfig = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    proxy: false,
  };

  if (validationStatues) {
    config.validateStatus = function (status: number) {
      return validationStatues.includes(status);
    };
  }

  if (sourceIp) {
    config.headers!["X-Forwarded-For"] = sourceIp;
  }

  if (persistentSessionId) {
    config.headers!["di-persistent-session-id"] = persistentSessionId;
  }

  if (sessionId) {
    config.headers!["Session-Id"] = sessionId;
  }

  if (userLanguage) {
    config.headers!["User-Language"] = userLanguage;
  }

  return config;
}

async function sendRequestWithAxios(snsMessage: SNSMessage) {
  console.log(`Sending PUT request with axios.`);

  const interceptor = aws4Interceptor({
    region: "eu-west-2",
    service: "execute-api",
  });

  axios.interceptors.request.use(interceptor);

  const requestConfig = getRequestConfig(
    snsMessage.token,
    null,
    snsMessage.sourceIp,
    snsMessage.persistentSessionId,
    snsMessage.sessionId
  );

  console.log("Request config:", requestConfig);

  let responseObject;
  try {
    const response: AxiosResponse = await axios.post(
      // "https://home.dev.account.gov.uk/delete-account",
      // "https://w91dhcuqij.execute-api.eu-west-2.amazonaws.com/dev/api/oidc-users/ana-test-user",
      "https://ehui589zg9.execute-api.eu-west-2.amazonaws.com/dev/test",
      snsMessage.email,
      requestConfig
    );

    if (response.data) {
      responseObject = {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
      };
    } else {
      responseObject = {
        status: response.status,
        statusText: response.statusText,
      };
    }
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
        if (!snsMessage.email) {
          throw new Error(
            `SNS Message did not contain the user email: ${JSON.stringify(
              snsMessage
            )}`
          );
        }
        await sendRequestWithAxios(snsMessage);
      } catch (err) {
        console.error(err);
      }
    })
  );
};
