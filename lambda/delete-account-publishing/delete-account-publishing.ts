import { SNSEvent } from "aws-lambda";
// import axios, {
//     AxiosInstance,
//     AxiosRequestConfig,
//     AxiosError,
//     AxiosResponse,
//     AxiosRequestHeaders,
// } from "axios";

export const handler = async (event: SNSEvent): Promise<void> => {
  console.log("SNS Event Message: ", JSON.parse(event.Records[0].Sns.Message));
  console.log("SNS Event: ", JSON.stringify(event));
};
