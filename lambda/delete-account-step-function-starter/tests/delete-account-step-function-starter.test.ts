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
  let consoleLogMock: jest.SpyInstance;

  beforeEach(() => {
    sfnMock.reset();
    consoleLogMock = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleLogMock.mockRestore();
  });

  test("that it successfully processes the SNS message", async () => {
    sfnMock
      .on(StartExecutionCommand, {
        input: JSON.stringify(TEST_USER_DATA),
        stateMachineArn: process.env.STEP_FUNCTION_ARN,
      })
      .resolves({
        $metadata: {
          httpStatusCode: 200,
          requestId: "493a2c58",
          attempts: 1,
          totalRetryDelay: 0,
        },
        executionArn: "test",
      });

    // eslint-disable-next-line @typescript-eslint/no-var-requires,global-require
    const module = require("../delete-account-step-function-starter");
    const validateSNSMessageMock = jest
      .spyOn(module, "validateSNSMessage")
      .mockReturnValueOnce("validateSNSMessage-mock");

    await expect(handler(TEST_SNS_EVENT)).resolves.not.toThrowError();
    expect(validateSNSMessageMock).toHaveBeenCalledTimes(1);
    expect(sfnMock.commandCalls(StartExecutionCommand).length).toEqual(1);
    expect(consoleLogMock).toHaveBeenNthCalledWith(
      3,
      'Response from StartExecutionCommand: {"$metadata":{"httpStatusCode":200,"requestId":"493a2c58","attempts":1,"totalRetryDelay":0},"executionArn":"test"}'
    );
  });

  test("that it starts the step function execution", async () => {
    sfnMock.on(StartExecutionCommand).resolves({});
    await handler(TEST_SNS_EVENT);
    expect(sfnMock.call(0).args[0].input).toEqual({
      input: JSON.stringify(TEST_USER_DATA),
      stateMachineArn: process.env.STEP_FUNCTION_ARN,
    });
  });

  describe("handler error handling", () => {
    let consoleErrorMock: jest.SpyInstance;

    beforeEach(() => {
      consoleErrorMock = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorMock.mockClear();
    });

    test("that it logs and throws an error if the StartExecutionCommand throws an error", async () => {
      sfnMock.rejectsOnce("step function error");
      await expect(async () => {
        await handler(TEST_SNS_EVENT);
      }).rejects.toThrowError();
      expect(consoleErrorMock).toHaveBeenCalledTimes(1);
      expect(consoleErrorMock).toHaveBeenCalledWith(
        "An error happened while trying to start the state machine. Error: Error: step function error."
      );
    });
  });
});

describe("validateSNSMessage", () => {
  test("that it does not throw an error if the SNS message is valid", () => {
    expect(validateSNSMessage(TEST_USER_DATA)).toBe(TEST_USER_DATA);
  });

  test("that it throws an error if the SNS message is missing the required attribute email", () => {
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
      "SNS Message is missing one or more of the required attributes 'email', 'access_token' and 'public_subject_id'."
    );
  });

  test("that it does not throw an error if the SNS message is missing the non-required attribute legacy_subject_id", () => {
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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("that the StartExecutionCommand gets called with the correct input", async () => {
    await startStateMachine(TEST_USER_DATA);
    expect(sfnMock).toHaveReceivedCommandWith(StartExecutionCommand, {
      stateMachineArn: process.env.STEP_FUNCTION_ARN,
      input: JSON.stringify(TEST_USER_DATA),
    });
  });

  test("that it returns the StartExecutionCommandOutput, i.e. response", async () => {
    sfnMock
      .on(StartExecutionCommand, {
        input: JSON.stringify(TEST_USER_DATA),
        stateMachineArn: process.env.STEP_FUNCTION_ARN,
      })
      .resolves({
        $metadata: {
          httpStatusCode: 200,
          requestId: "493a2c58",
          attempts: 1,
          totalRetryDelay: 0,
        },
        executionArn: "test",
      });
    const response = await startStateMachine(TEST_USER_DATA);
    expect(sfnMock).toHaveReceivedCommandWith(StartExecutionCommand, {
      stateMachineArn: process.env.STEP_FUNCTION_ARN,
      input: JSON.stringify(TEST_USER_DATA),
    });
    expect(response).toEqual({
      $metadata: {
        attempts: 1,
        httpStatusCode: 200,
        requestId: "493a2c58",
        totalRetryDelay: 0,
      },
      executionArn: "test",
    });
  });
});
