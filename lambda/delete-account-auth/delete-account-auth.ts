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

export const validateSNSMessage = (snsMessage: SNSMessage): SNSMessage => {
  if (
    !snsMessage.email ||
    !snsMessage.token ||
    !snsMessage.sourceIp ||
    !snsMessage.persistentSessionId ||
    !snsMessage.sessionId
  ) {
    throw new Error(
      `SNS Message is missing a required attribute. ${JSON.stringify(
        snsMessage
      )}`
    );
  }
  return snsMessage;
};

async function sendRequestWithAxios(snsMessage: SNSMessage) {
  console.log(`Sending a POST request with axios.`);

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
      "https://home.dev.account.gov.uk/delete-account",
      { email: snsMessage.email },
      requestConfig
    );

    responseObject = {
      status: response.status,
      statusText: response.statusText,
      data: response.data,
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
  console.log("Returning the response:", responseObject);
  return responseObject;
}

export const handler = async (event: SNSEvent): Promise<void> => {
  console.log("SNS Event: ", JSON.stringify(event));

  await Promise.all(
    event.Records.map(async (record) => {
      try {
        const snsMessage: SNSMessage = JSON.parse(record.Sns.Message);
        console.log("Parsed SNS Message:", snsMessage);
        validateSNSMessage(snsMessage);
        await sendRequestWithAxios(snsMessage);
      } catch (err) {
        console.error(err);
      }
    })
  );
};
