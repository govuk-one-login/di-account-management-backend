import axios, { AxiosResponse } from "axios";
import {
  handler,
  sendRequest,
  getRequestConfig,
  validateSNSMessage,
} from "../delete-one-login-account";
import { TEST_USER_DATA, TEST_STEP_FUNCTION_EVENT } from "./test-helpers";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("handler", () => {
  let consoleLogMock: jest.SpyInstance;
  beforeEach(() => {
    jest.restoreAllMocks();
    consoleLogMock = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterAll(() => {
    consoleLogMock.mockRestore();
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleLogMock.mockClear();
  });

  test("that it successfully processes the SNS message", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires,global-require
    const module = require("../delete-one-login-account");
    const validateSNSMessageMock = jest
      .spyOn(module, "validateSNSMessage")
      .mockReturnValueOnce("validateSNSMessage-mock");

    const sendRequestMock = jest
      .spyOn(module, "sendRequest")
      .mockReturnValue("sendRequest-mock");

    await expect(handler(TEST_STEP_FUNCTION_EVENT)).resolves.not.toThrowError();
    expect(consoleLogMock).toHaveBeenCalledTimes(2);
    expect(validateSNSMessageMock).toHaveBeenCalledTimes(1);
    expect(validateSNSMessageMock).toHaveBeenCalledWith(TEST_USER_DATA);
    expect(sendRequestMock).toHaveBeenCalledTimes(1);
    expect(sendRequestMock).toHaveBeenCalledWith(TEST_USER_DATA);
  });

  test("that it does not throw an error if axios returns a successful response", async () => {
    mockedAxios.post.mockResolvedValue({
      data: {},
      status: 200,
      statusText: "OK",
    });
    await expect(handler(TEST_STEP_FUNCTION_EVENT)).resolves.not.toThrowError();
  });

  describe("handler error handling", () => {
    let consoleErrorMock: jest.SpyInstance;

    beforeEach(() => {
      consoleErrorMock = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockedAxios.post.mockRejectedValueOnce(new Error("error"));
    });

    afterAll(() => {
      consoleErrorMock.mockRestore();
    });

    afterEach(() => {
      consoleErrorMock.mockClear();
    });

    test("that it throws an error if axios throws an error", async () => {
      await expect(async () => {
        await handler(TEST_STEP_FUNCTION_EVENT);
      }).rejects.toThrowError();
      expect(consoleErrorMock).toHaveBeenCalledTimes(1);
      expect(consoleErrorMock).toHaveBeenCalledWith(
        "Unable to send POST request to Auth HTTP API. Error:Error: error"
      );
    });
  });
});

describe("getRequestConfig", () => {
  test("that the headers contain only Authorization if only the attribute access_token is true and all others are undefined", () => {
    expect(
      getRequestConfig("access_token", undefined, undefined, undefined)
    ).toEqual({
      headers: { Authorization: "Bearer access_token" },
      proxy: false,
    });
  });

  test("that X-Forwarded-For is added to the headers if the attribute source_ip is true", () => {
    expect(
      getRequestConfig("access_token", "source_ip", undefined, undefined)
    ).toEqual({
      headers: {
        Authorization: "Bearer access_token",
        "X-Forwarded-For": "source_ip",
      },
      proxy: false,
    });
  });

  test("that all possible attributes are added to the headers if all are true", () => {
    expect(
      getRequestConfig(
        "access_token",
        "source_ip",
        "persistent_session_id",
        "session_id"
      )
    ).toEqual({
      headers: {
        Authorization: "Bearer access_token",
        "Session-Id": "session_id",
        "X-Forwarded-For": "source_ip",
        "di-persistent-session-id": "persistent_session_id",
      },
      proxy: false,
    });
  });
});

describe("sendRequest", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("that it returns the response returned by axios when the request is successful", async () => {
    const mockResponse = {
      data: {},
      status: 200,
      statusText: "OK",
    } as AxiosResponse;
    mockedAxios.post.mockResolvedValue(mockResponse);
    const response = await sendRequest(TEST_USER_DATA);
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      "https://test.com/delete-account",
      { email: "email" },
      {
        headers: {
          Authorization: "Bearer access_token",
          "Session-Id": "session_id",
          "X-Forwarded-For": "source_ip",
          "di-persistent-session-id": "persistent_session_id",
        },
        proxy: false,
      }
    );
    expect(response).toEqual({
      data: {},
      status: 200,
      statusText: "OK",
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
      "SNS Message is missing one or both of the required attributes 'email' and 'access_token'."
    );
  });

  test("that it does not throw an error if the SNS message is missing the non-required attribute user_id", () => {
    const snsMessage = JSON.parse(
      JSON.stringify({
        user_id: "user-id",
        access_token: "access_token",
        email: "email",
        source_ip: "source_ip",
        persistent_session_id: "persistent_session_id",
        legacy_subject_id: "legacy_subject_id",
        public_subject_id: "public_subject_id",
      })
    );
    expect(validateSNSMessage(snsMessage)).toBe(snsMessage);
  });
});
