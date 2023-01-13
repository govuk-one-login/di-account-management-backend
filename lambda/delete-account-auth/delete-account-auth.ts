import { SNSEvent } from "aws-lambda";
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { aws4Interceptor } from "aws4-axios";
import { SNSMessage } from "./models";

export function getRequestConfig(
  // eslint-disable-next-line camelcase
  access_token: string,
  validationStatus?: number[] | null,
  ip?: string,
  // eslint-disable-next-line camelcase
  persistent_session_id?: string,
  // eslint-disable-next-line camelcase
  session_id?: string,
  userLanguage?: string
): AxiosRequestConfig {
  const config: AxiosRequestConfig = {
    headers: {
      // eslint-disable-next-line camelcase
      Authorization: `Bearer ${access_token}`,
    },
    proxy: false,
  };

  if (validationStatus) {
    config.validateStatus = function (status: number) {
      return validationStatus.includes(status);
    };
  }

  if (ip) {
    config.headers!["X-Forwarded-For"] = ip;
  }

  // eslint-disable-next-line camelcase
  if (persistent_session_id) {
    // eslint-disable-next-line camelcase
    config.headers!["di-persistent-session-id"] = persistent_session_id;
  }

  // eslint-disable-next-line camelcase
  if (session_id) {
    // eslint-disable-next-line camelcase
    config.headers!["Session-Id"] = session_id;
  }

  if (userLanguage) {
    config.headers!["User-Language"] = userLanguage;
  }

  return config;
}

export const validateSNSMessage = (snsMessage: SNSMessage): SNSMessage => {
  if (
    !snsMessage.email ||
    !snsMessage.access_token ||
    !snsMessage.ip ||
    !snsMessage.persistent_session_id ||
    !snsMessage.session_id
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
    snsMessage.access_token,
    null,
    snsMessage.ip,
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

    console.log(`Response: ${responseObject}`);

    return responseObject;
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
