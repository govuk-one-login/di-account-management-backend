import { SNSEvent, SQSEvent, SQSRecord } from "aws-lambda";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { UserData } from "./common/model";

export const lambdaClient = new LambdaClient();

const logIdentifiers = (record: SQSRecord): void => {
  const parsedBody: SNSEvent = JSON.parse(record.body);
  for (const snsRecord of parsedBody.Records) {
    const userData: UserData = JSON.parse(snsRecord.Sns.Message);
    console.log(
      `Redriving message with publicSubjectId: ${userData.public_subject_id}, legacySubjectId: ${userData.legacy_subject_id}`
    );
  }
};

export const handler = async (event: SQSEvent): Promise<void> => {
  for (const record of event.Records) {
    logIdentifiers(record);
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
