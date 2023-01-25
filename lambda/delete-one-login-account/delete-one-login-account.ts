import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { aws4Interceptor } from "aws4-axios";
import { Payload } from "./models";

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

export const validatePayload = (payload: Payload) => {
  if (!payload.email || !payload.access_token) {
    throw new Error(
      `Payload is missing one or both of the required attributes "email" and "access_token".`
    );
  }
  return payload;
};

export async function sendRequest(payload: Payload) {
  console.log("Sending POST request to Auth HTTP API.");

  const interceptor = aws4Interceptor({
    region: "eu-west-2",
    service: "execute-api",
  });

  axios.interceptors.request.use(interceptor);

  const requestConfig = getRequestConfig(
    payload.access_token,
    payload.source_ip,
    payload.persistent_session_id,
    payload.session_id
  );
  const deleteUrl = `${process.env.MOCK_PUBLISHING_API_URL}/delete-account`;
  // const deleteUrl = "https://home.dev.account.gov.uk/delete-account";

  console.log(
    `Request config: ${JSON.stringify(requestConfig)}, URL: ${deleteUrl}`
  );

  try {
    const response: AxiosResponse = await axios.post(
      deleteUrl,
      { email: payload.email },
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
    console.log(`Unable to send POST request to Auth HTTP API. Error:${error}`);
    throw Error(error);
  }
}

export const handler = async (event: {
  Payload: Payload;
  FunctionName: string;
}): Promise<void> => {
  console.log(`Input event received: ${JSON.stringify(event)}`);
  const payload = event.Payload;
  console.log(`Event payload: ${JSON.stringify(payload)}`);
  validatePayload(payload);
  await sendRequest(payload);
};
