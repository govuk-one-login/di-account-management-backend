import { SNSEvent } from "aws-lambda";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { SNSMessage } from "./models";

export const handler = async (event: SNSEvent): Promise<void> => {
  console.log(`SNS Event: ${JSON.stringify(event)}`);

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

        const command = new StartExecutionCommand(input);
        const response = await client.send(command);
        console.log(`Response: ${JSON.stringify(response)}`);

        // validateSNSMessage(snsMessage); SHOULD THE VALIDATION BE IMPLEMENTED HERE?
      } catch (error) {
        console.error(`An error occurred. Error: ${error}.`);
      }
    })
  );
};
