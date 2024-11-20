import { SQSEvent } from "aws-lambda";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";

const lambdaClient = new LambdaClient();

export const handler = async (event: SQSEvent): Promise<void> => {
  for (const record of event.Records) {
    const command = new InvokeCommand({
      FunctionName: process.env.DELETE_EMAIL_SUBSCRIPTIONS_LAMBDA_ALIAS,
      Payload: record.body,
    });
    const response = await lambdaClient.send(command);
    if (
      response.StatusCode &&
      (response.StatusCode > 299 || response.StatusCode < 200)
    ) {
      throw new Error("Redrive failed");
    }
  }
};
