import { SNSEvent } from "aws-lambda";
import aws from "aws-sdk";
import { SNSMessage } from "./models";

export const handler = async (event: SNSEvent): Promise<void> => {
  console.log(`SNS Event: ${JSON.stringify(event)}`);

  const stepFunction = new aws.StepFunctions();

  await Promise.all(
    event.Records.map(async (record) => {
      try {
        const snsMessage: SNSMessage = JSON.parse(record.Sns.Message);
        console.log(`Parsed SNS Message: ${JSON.stringify(snsMessage)}`);

        const params = {
          stateMachineArn: process.env.STEP_FUNCTION_ARN!,
          input: JSON.stringify(snsMessage),
        };

        stepFunction.startExecution(params, function (error, data) {
          if (error) {
            console.log(
              `An error occurred while trying to execute the step function. Error: ${error}.`
            );
          }
          console.log("Started executing the step function.");
        });

        // validateSNSMessage(snsMessage);
      } catch (error) {
        console.error(`An error occurred. Error: ${error}.`);
      }
    })
  );
};
