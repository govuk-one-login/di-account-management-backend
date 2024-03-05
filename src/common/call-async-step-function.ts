import type { MarkActivityAsReportedInput } from "./model";
import {
  SFNClient,
  StartExecutionCommand,
  StartExecutionInput,
  StartExecutionOutput,
} from "@aws-sdk/client-sfn";

export async function callAsyncStepFunction(
  stateMachineArn: string,
  input: MarkActivityAsReportedInput
): Promise<string> {
  let response: StartExecutionOutput;
  try {
    console.log("Starting state machine execution.");
    response = await startASyncStepFunction(stateMachineArn, input);
  } catch (error: unknown) {
    console.error("Failed to start Report Suspicious Activity state machine.", {
      stepFunctionArn: stateMachineArn,
    });
    console.error("Reason Detail: ", (error as Error).message);
    throw error;
  }

  return JSON.stringify(response);
}

const { AWS_REGION } = process.env;
export const stepFunctionsClient = new SFNClient({
  region: AWS_REGION,
  maxAttempts: 1000000,
});

async function startASyncStepFunction(
  stepFunctionARN: string,
  input: object
): Promise<StartExecutionOutput> {
  const parameters: StartExecutionInput = {
    stateMachineArn: stepFunctionARN,
    input: JSON.stringify(input),
  };

  return await stepFunctionsClient.send(new StartExecutionCommand(parameters));
}
