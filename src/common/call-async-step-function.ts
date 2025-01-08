import type { ReportSuspiciousActivityStepInput } from "./model";
import {
  SFNClient,
  StartExecutionCommand,
  StartExecutionInput,
  StartExecutionOutput,
} from "@aws-sdk/client-sfn";

export const stepFunctionsClient = new SFNClient({
  region: process.env.AWS_REGION,
  maxAttempts: 1000000,
});

export async function callAsyncStepFunction(
  stateMachineArn: string,
  input: ReportSuspiciousActivityStepInput
): Promise<string> {
  try {
    const response = await startASyncStepFunction(stateMachineArn, input);
    return JSON.stringify(response);
  } catch (error: unknown) {
    console.error("Failed to start Report Suspicious Activity state machine:", {
      stepFunctionArn: stateMachineArn,
      error,
    });
    throw error;
  }
}

async function startASyncStepFunction(
  stepFunctionARN: string,
  input: object
): Promise<StartExecutionOutput> {
  const parameters: StartExecutionInput = {
    stateMachineArn: stepFunctionARN,
    input: JSON.stringify(input),
  };
  return stepFunctionsClient.send(new StartExecutionCommand(parameters));
}
