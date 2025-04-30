import { Logger } from "@aws-lambda-powertools/logger";
import type { ReportSuspiciousActivityStepInput } from "./model";
import {
  SFNClient,
  StartExecutionCommand,
  StartExecutionInput,
  StartExecutionOutput,
} from "@aws-sdk/client-sfn";

const logger = new Logger();

export async function callAsyncStepFunction(
  stateMachineArn: string,
  input: ReportSuspiciousActivityStepInput
): Promise<string> {
  let response: StartExecutionOutput;
  try {
    logger.info("Starting state machine execution.");
    response = await startASyncStepFunction(stateMachineArn, input);
  } catch (error: unknown) {
    logger.error("Failed to start Report Suspicious Activity state machine.", {
      stepFunctionArn: stateMachineArn,
    });
    logger.error("Reason Detail: ", (error as Error).message);
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
