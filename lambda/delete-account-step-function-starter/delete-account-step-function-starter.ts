import { SNSEvent } from "aws-lambda";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { SNSMessage } from "./models";

export const handler = async (event: SNSEvent): Promise<void> => {
  console.log(`Received SNS Event: ${JSON.stringify(event)}`);

  const client = new SFNClient({ region: "eu-west-2" });

  await Promise.all(
    event.Records.map(async (record) => {
      try {
        const snsMessage: SNSMessage = JSON.parse(record.Sns.Message);
        console.log(`Parsed SNS Message: ${JSON.stringify(snsMessage)}`);

        const input = {
          stateMachineArn: process.env.STEP_FUNCTION_ARN!,
          input: JSON.stringify(snsMessage),
        };

        console.log("Starting state machine execution.");

        const command = new StartExecutionCommand(input);
        const response = await client.send(command);
        console.log(
          `Response from StartExecutionCommand: ${JSON.stringify(response)}`
        );
      } catch (error: any) {
        console.error(`An error occurred. Error: ${error}.`);
        throw Error(error);
      }
    })
  );
};
