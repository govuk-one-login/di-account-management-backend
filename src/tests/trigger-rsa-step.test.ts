import "aws-sdk-client-mock-jest";
import { handler } from "../trigger-rsa-step";
import {
  testSuspiciousActivity,
  createSnsEvent,
  messageId,
} from "./testFixtures";
import { callAsyncStepFunction } from "../common/call-async-step-function";
import { mockClient } from "aws-sdk-client-mock";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

jest.mock("../common/call-async-step-function.ts");
const sqsMock = mockClient(SQSClient);

describe("handler", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.STATE_MACHINE_ARN = "ReportSuspiciousActivityStepFunction";
    process.env.AWS_REGION = "AWS_REGION";
    (callAsyncStepFunction as jest.Mock).mockImplementation(() => {
      return {
        executionArn: "dummy-executionArn",
      };
    });
    sqsMock.reset();
    sqsMock.on(SendMessageCommand).resolves({ MessageId: messageId });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("the handler triggers the report suspicious activity step function successfully", async () => {
    await handler(createSnsEvent(testSuspiciousActivity));
    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(0);
  });

  test("the handler log and send message to SQS when error occurs", async () => {
    let errorMessage;
    try {
      await handler(createSnsEvent({}));
    } catch (error) {
      errorMessage = (error as Error).message;
    }
    expect(errorMessage).toContain(
      "Unable to trigger rsa step for message with ID: MessageId, Validation Failed - Required input to trigger report suspicious activity steps are not provided"
    );
  });
});
