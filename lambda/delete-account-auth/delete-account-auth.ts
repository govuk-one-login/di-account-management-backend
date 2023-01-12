import { SNSEvent } from "aws-lambda";
import axios, { AxiosError, AxiosResponse } from "axios";
import { aws4Interceptor } from "aws4-axios";
import { SNSMessage } from "./models";

async function sendRequestWithAxios(email: SNSMessage) {
  console.log(`Sending POST request with axios.`);

  const interceptor = aws4Interceptor({
    region: "eu-west-2",
    service: "execute-api",
  });

  axios.interceptors.request.use(interceptor);

  let responseObject;
  try {
    const response: AxiosResponse = await axios({
      method: "POST",
      url: "https://home.dev.account.gov.uk/delete-account",
      data: {
        email,
      },
      headers: {
        Authorization: `Bearer blah blah`,
      },
      proxy: false,
    });

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
    if (axios.isAxiosError(error)) {
      responseObject = {
        message: error.message,
        name: error.name,
        status: error.status,
      };
    }
  }
  console.log("Done. Returning the response.");
  return responseObject;
}

export const handler = async (event: SNSEvent): Promise<void> => {
  console.log("SNS Event: ", JSON.stringify(event));

  await Promise.all(
    event.Records.map(async (record) => {
      try {
        const snsMessage: SNSMessage = JSON.parse(record.Sns.Message);
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
