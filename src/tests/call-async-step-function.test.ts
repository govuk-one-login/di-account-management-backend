import { vi, describe, it, expect, beforeEach, afterEach, MockInstance } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import {
  StartExecutionCommand,
  StartSyncExecutionCommand,
} from "@aws-sdk/client-sfn";
import { testSuspiciousActivity } from "./testFixtures.js";
import {
  callAsyncStepFunction,
  stepFunctionsClient,
} from "../common/call-async-step-function.js";
import { Logger } from "@aws-lambda-powertools/logger";

const mockStepFunctionClient = mockClient(stepFunctionsClient);

const testStepFunctionARN =
  "arn:aws:states:eu-west-2:111122223333:stateMachine:0_StateMachine-a-b-c.Report-suspicious";

describe("start report suspicious activities step function", () => {
  const input = testSuspiciousActivity;
  let loggerErrorMock: MockInstance;
  beforeEach(() => {
    process.env.AWS_REGION = "AWS_REGION";
    loggerErrorMock = vi
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    mockStepFunctionClient.on(StartExecutionCommand).resolves({
      executionArn: "dummy-executionArn",
    });
  });
  afterEach(() => {
    loggerErrorMock.mockRestore();
    vi.clearAllMocks();
  });

  it("step function completes successfully without errors", async () => {
    await callAsyncStepFunction(testStepFunctionARN, input);
    expect(mockStepFunctionClient).toHaveReceivedCommandWith(
      StartExecutionCommand,
      {
        stateMachineArn:
          "arn:aws:states:eu-west-2:111122223333:stateMachine:0_StateMachine-a-b-c.Report-suspicious",
        input: JSON.stringify(testSuspiciousActivity),
      }
    );
  });

  it("should throw an error if the step function client throws an error", async () => {
    mockStepFunctionClient
      .on(StartExecutionCommand)
      .rejects("SomeStepFunctionException");
    await expect(
      async () => await callAsyncStepFunction(testStepFunctionARN, input)
    ).rejects.toThrow("SomeStepFunctionException");
    expect(loggerErrorMock).toHaveBeenCalledTimes(2);
    expect(loggerErrorMock.mock.calls[0][0]).toContain(
      "Failed to start Report Suspicious Activity state machine."
    );
  });

  it("should NOT throw an error if the execution fails", async () => {
    mockStepFunctionClient.on(StartSyncExecutionCommand).resolves({
      executionArn:
        "arn:aws:states:eu-west-2:111122223333:stateMachine:dummy-executionArn",
      status: "FAILED",
    });
    await callAsyncStepFunction(testStepFunctionARN, input);
    expect(mockStepFunctionClient).toHaveReceivedCommandWith(
      StartExecutionCommand,
      {
        stateMachineArn:
          "arn:aws:states:eu-west-2:111122223333:stateMachine:0_StateMachine-a-b-c.Report-suspicious",
        input: JSON.stringify(testSuspiciousActivity),
      }
    );
  });
});
