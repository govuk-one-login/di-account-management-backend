import { vi, describe, test, expect, beforeEach, afterEach } from "vitest";
import { handler } from "../trigger-rsa-step.js";
import {
  testSuspiciousActivity,
  createSnsEvent,
  messageId,
} from "./testFixtures.js";
import { callAsyncStepFunction } from "../common/call-async-step-function.js";
import { mockClient } from "aws-sdk-client-mock";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { Context } from "aws-lambda";

vi.mock("../common/call-async-step-function.js");
const sqsMock = mockClient(SQSClient);

describe("handler", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.STATE_MACHINE_ARN = "ReportSuspiciousActivityStepFunction";
    process.env.AWS_REGION = "AWS_REGION";
    (callAsyncStepFunction as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
      return {
        executionArn: "dummy-executionArn",
      };
    });
    sqsMock.reset();
    sqsMock.on(SendMessageCommand).resolves({ MessageId: messageId });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("the handler triggers the report suspicious activity step function successfully", async () => {
    await handler(createSnsEvent(testSuspiciousActivity), {} as Context);
    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(0);
  });

  test("the handler log and send message to SQS when error occurs", async () => {
    let errorMessage;
    try {
      await handler(createSnsEvent({}), {} as Context);
    } catch (error) {
      errorMessage = (error as Error).message;
    }
    expect(errorMessage).toContain(
      "Unable to trigger rsa step for message with ID: MessageId, Validation Failed - Required input to trigger report suspicious activity steps are not provided"
    );
  });
});
