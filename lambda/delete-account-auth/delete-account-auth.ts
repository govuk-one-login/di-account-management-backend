import { SNSEvent } from "aws-lambda";
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { aws4Interceptor } from "aws4-axios";
import { SNSMessage } from "./models";

export function getRequestConfig(
  token: string,
  validationStatus?: number[] | null,
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

  if (validationStatus) {
    config.validateStatus = function (status: number) {
      return validationStatus.includes(status);
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

export const validateSNSMessage = (snsMessage: SNSMessage): SNSMessage => {
  if (
    !snsMessage.email ||
    !snsMessage.token ||
    !snsMessage.sourceIp ||
    !snsMessage.persistentSessionId ||
    !snsMessage.sessionId
  ) {
    throw new Error(
      `SNS Message is missing one or more required attribute/s. ${JSON.stringify(
        snsMessage
      )}`
    );
  }
  return snsMessage;
};

async function sendRequest(snsMessage: SNSMessage) {
  console.log("Sending POST request to Auth.");

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
  const deleteUrl = `${process.env.MOCK_PUBLISHING_API_URL}/api/oidc-users/ana-test-friday`;
  // const deleteUrl = "https://home.dev.account.gov.uk/delete-account";

  console.log(
    `Request config: ${JSON.stringify(requestConfig)}, URL: ${deleteUrl}`
  );

  try {
    // Change PUT TO POST
    const response: AxiosResponse = await axios.put(
      deleteUrl,
      { email: snsMessage.email },
      requestConfig
    );
    return {
      status: response.status,
      statusText: response.statusText,
      data: response.data,
    };
  } catch (error) {
    console.log(
      `Unable to send delete account POST request to Auth. Error:${error}`
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
        validateSNSMessage(snsMessage);
        await sendRequest(snsMessage);
      } catch (error) {
        console.error(error);
      }
    })
  );
};
