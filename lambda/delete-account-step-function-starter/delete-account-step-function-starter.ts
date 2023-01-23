import { SNSEvent } from "aws-lambda";
import {
  SFNClient,
  StartExecutionCommand,
  StartExecutionCommandOutput,
} from "@aws-sdk/client-sfn";
import { SNSMessage } from "./models";

const sfnClient = new SFNClient({ region: "eu-west-2" });

export const validateSNSMessage = (snsMessage: SNSMessage): SNSMessage => {
  if (
    !snsMessage.email ||
    !snsMessage.access_token ||
    !snsMessage.public_subject_id
  ) {
    throw new Error(
      "SNS message is missing one or more of the required attributes 'email', 'access_token' 'public_subject_id'"
    );
  }

  return snsMessage;
};

export const startStateMachine = async (
  snsMessage: SNSMessage
): Promise<StartExecutionCommandOutput> => {
  console.log("Starting state machine execution.");

  const command = new StartExecutionCommand({
    stateMachineArn: process.env.STEP_FUNCTION_ARN!,
    input: JSON.stringify(snsMessage),
  });
  return sfnClient.send(command);
};

export const handler = async (event: SNSEvent): Promise<void> => {
  console.log(`Received SNS Event: ${JSON.stringify(event)}`);

  await Promise.all(
    event.Records.map(async (record) => {
      const snsMessage: SNSMessage = JSON.parse(record.Sns.Message);
      validateSNSMessage(snsMessage);
      try {
        const response = await startStateMachine(snsMessage);
        console.log(
          `Response from StartExecutionCommand: ${JSON.stringify(response)}`
        );
      } catch (error: any) {
        console.error(
          `An error happened while trying to start the state machine. Error: ${error}.`
        );
        throw Error(error);
      }
    })
  );
};
