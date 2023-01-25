import "aws-sdk-client-mock-jest";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { mockClient } from "aws-sdk-client-mock";
import {
  handler,
  startStateMachine,
  validateSNSMessage,
} from "../delete-account-step-function-starter";
import { TEST_USER_DATA, TEST_SNS_EVENT } from "./test-helpers";

const sfnMock = mockClient(SFNClient);

describe("handler", () => {
  beforeEach(() => {
    sfnMock.reset();
    process.env.STEP_FUNCTION_ARN = "STEP_FUNCTION_ARN";
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("if it iterates over each SNS record in the batch", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires,global-require
    const module = require("../delete-account-step-function-starter");
    const validateSNSMessageMock = jest
      .spyOn(module, "validateSNSMessage")
      .mockReturnValueOnce("validateSNSMessage-mock");
    await handler(TEST_SNS_EVENT);
    expect(sfnMock.commandCalls(StartExecutionCommand).length).toEqual(2);
    expect(validateSNSMessageMock).toHaveBeenCalledTimes(2);
  });

  test("if it starts the step function execution", async () => {
    sfnMock.on(StartExecutionCommand).resolves({});
    await handler(TEST_SNS_EVENT);
    expect(sfnMock.call(0).args[0].input).toEqual({
      input: JSON.stringify(TEST_USER_DATA),
      stateMachineArn: "STEP_FUNCTION_ARN",
    });
  });

  describe("handler error handling", () => {
    let consoleErrorMock: jest.SpyInstance;

    beforeEach(() => {
      consoleErrorMock = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      sfnMock.rejectsOnce("mock error");
    });

    afterAll(() => {
      consoleErrorMock.mockRestore();
    });

    afterEach(() => {
      consoleErrorMock.mockClear();
    });

    test("if the handler logs and throws an error when the StartExecutionCommand throws an error", async () => {
      await expect(async () => {
        await handler(TEST_SNS_EVENT);
      }).rejects.toThrowError();
      expect(consoleErrorMock).toHaveBeenCalledTimes(1);
    });
  });
});

describe("validateSNSMessage", () => {
  test("that it doesn't throw an error when the SNS message is valid", () => {
    expect(validateSNSMessage(TEST_USER_DATA)).toBe(TEST_USER_DATA);
  });

  test("that it throws an error when the SNS message is missing the required attribute 'email'", () => {
    const snsMessage = JSON.parse(
      JSON.stringify({
        user_id: "user-id",
        access_token: "access_token",
        source_ip: "source_ip",
        persistent_session_id: "persistent_session_id",
        session_id: "session_id",
        public_subject_id: "public_subject_id",
        legacy_subject_id: "legacy_subject_id",
      })
    );
    expect(() => {
      validateSNSMessage(snsMessage);
    }).toThrowError(
      "SNS message is missing one or more of the required attributes 'email', 'access_token' 'public_subject_id'"
    );
  });

  test("that it doesn't throw an error when the SNS message is missing a non-required attribute", () => {
    const snsMessage = JSON.parse(
      JSON.stringify({
        user_id: "user-id",
        access_token: "access_token",
        email: "email",
        source_ip: "source_ip",
        persistent_session_id: "persistent_session_id",
        session_id: "session_id",
        public_subject_id: "public_subject_id",
      })
    );
    expect(validateSNSMessage(snsMessage)).toBe(snsMessage);
  });
});

describe("startStateMachine", () => {
  beforeEach(() => {
    sfnMock.reset();
    process.env.STEP_FUNCTION_ARN = "STEP_FUNCTION_ARN";
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("if the StartExecutionCommand gets called called with the correct input", async () => {
    await startStateMachine(TEST_USER_DATA);
    expect(sfnMock).toHaveReceivedCommandWith(StartExecutionCommand, {
      stateMachineArn: process.env.STEP_FUNCTION_ARN,
      input: JSON.stringify(TEST_USER_DATA),
    });
  });
});
