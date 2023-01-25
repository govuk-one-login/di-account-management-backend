import axios, { AxiosResponse } from "axios";
import {
  handler,
  sendRequest,
  getRequestConfig,
  validateSNSMessage,
} from "../delete-email-subscriptions";
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
    const module = require("../delete-email-subscriptions");
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
    mockedAxios.delete.mockResolvedValue({
      data: {},
      status: 204,
      statusText: "No Content",
    });
    await expect(handler(TEST_STEP_FUNCTION_EVENT)).resolves.not.toThrowError();
  });

  describe("handler error handling", () => {
    let consoleErrorMock: jest.SpyInstance;

    beforeEach(() => {
      consoleErrorMock = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockedAxios.delete.mockRejectedValueOnce(new Error("error"));
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
        "Unable to send DELETE request to GOV.UK API. Error:Error: error"
      );
    });
  });
});

describe("getRequestConfig", () => {
  test("that it returns the request config in the correct format", () => {
    expect(getRequestConfig("TOKEN")).toEqual({
      headers: { Authorization: "Bearer TOKEN" },
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

  test("that the URL contains a query parameter if legacy_subject_id is true", async () => {
    await sendRequest(TEST_USER_DATA);
    expect(mockedAxios.delete).toHaveBeenCalledWith(
      "https://test.com/api/oidc-users/public_subject_id?legacy_sub=legacy_subject_id",
      { headers: { Authorization: "Bearer TOKEN" }, proxy: false }
    );
  });

  test("that the URL does not contain a query parameter if legacy_subject_id is false", async () => {
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
    await sendRequest(snsMessage);
    expect(mockedAxios.delete).toHaveBeenCalledWith(
      "https://test.com/api/oidc-users/public_subject_id",
      { headers: { Authorization: "Bearer TOKEN" }, proxy: false }
    );
  });

  test("that it returns the response returned by axios if the request is successful", async () => {
    const mockResponse = {
      data: {},
      status: 204,
      statusText: "No Content",
    } as AxiosResponse;
    mockedAxios.delete.mockResolvedValue(mockResponse);
    const response = await sendRequest(TEST_USER_DATA);
    expect(mockedAxios.delete).toHaveBeenCalledTimes(1);
    expect(mockedAxios.delete).toHaveBeenCalledWith(
      "https://test.com/api/oidc-users/public_subject_id?legacy_sub=legacy_subject_id",
      {
        headers: {
          Authorization: "Bearer TOKEN",
        },
        proxy: false,
      }
    );
    expect(response).toEqual({
      data: {},
      status: 204,
      statusText: "No Content",
    });
  });
});

describe("validateSNSMessage", () => {
  test("that it does not throw an error if the SNS message is valid", () => {
    expect(validateSNSMessage(TEST_USER_DATA)).toBe(TEST_USER_DATA);
  });

  test("that it throws an error if the SNS message is missing the required attribute public_subject_id", () => {
    const snsMessage = JSON.parse(
      JSON.stringify({
        user_id: "user-id",
        access_token: "access_token",
        email: "email",
        source_ip: "source_ip",
        persistent_session_id: "persistent_session_id",
        session_id: "session_id",
        legacy_subject_id: "legacy_subject_id",
      })
    );
    expect(() => {
      validateSNSMessage(snsMessage);
    }).toThrowError(
      "SNS message is missing the required attribute 'public_subject_id'."
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
