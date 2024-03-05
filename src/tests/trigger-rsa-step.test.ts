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
  let consoleErrorMock: jest.SpyInstance;
  beforeEach(() => {
    jest.resetModules();
    process.env.STATE_MACHINE_ARN = "ReportSuspiciousActivityStepFunction";
    process.env.DLQ_URL = "DLQ_URL";
    consoleErrorMock = jest.spyOn(global.console, "error").mockImplementation();
    (callAsyncStepFunction as jest.Mock).mockImplementation(() => {
      return {
        executionArn: "dummy-executionArn",
      };
    });
    sqsMock.reset();
    sqsMock.on(SendMessageCommand).resolves({ MessageId: messageId });
  });

  afterEach(() => {
    consoleErrorMock.mockRestore();
    jest.clearAllMocks();
  });

  test("the handler triggers the report suspicious activity step function successfully", async () => {
    await handler(createSnsEvent(testSuspiciousActivity));
    expect(consoleErrorMock).not.toHaveBeenCalled();
    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(0);
  });

  test("the handler log and send message to SQS when error occurs", async () => {
    await handler(createSnsEvent({}));
    expect(consoleErrorMock).toHaveBeenCalledTimes(2);
    expect(consoleErrorMock.mock.calls[0][0]).toContain(
      "[Error occurred], trigger report suspicious activity step function:, Validation Failed - Required input to trigger report suspicious activity steps are not provided"
    );
    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(1);
    expect(sqsMock).toHaveReceivedNthCommandWith(1, SendMessageCommand, {
      QueueUrl: "DLQ_URL",
      MessageBody: JSON.stringify({}),
    });
  });
});
