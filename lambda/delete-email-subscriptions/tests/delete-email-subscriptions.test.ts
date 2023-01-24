import axios, { AxiosResponse } from "axios";
import {
  handler,
  sendRequest,
  getRequestConfig,
  validateSNSMessage,
} from "../delete-email-subscriptions";
import { TEST_USER_DATA, TEST_SNS_EVENT } from "./test-helpers";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("handler", () => {
  let consoleLogMock: jest.SpyInstance;
  beforeEach(() => {
    jest.restoreAllMocks();
    process.env.GOV_ACCOUNTS_PUBLISHING_API_TOKEN = "TOKEN";
    process.env.MOCK_PUBLISHING_API_URL = "https://test.com/";
    consoleLogMock = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterAll(() => {
    consoleLogMock.mockRestore();
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleLogMock.mockClear();
  });

  test("that it iterates over each SNS record in the batch", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires,global-require
    const module = require("../delete-email-subscriptions");
    const validateSNSMessageMock = jest
      .spyOn(module, "validateSNSMessage")
      .mockReturnValueOnce("validateSNSMessage-mock");

    const sendRequestMock = jest
      .spyOn(module, "sendRequest")
      .mockReturnValue("sendRequest-mock");

    await handler(TEST_SNS_EVENT);
    expect(consoleLogMock).toHaveBeenCalledTimes(3);
    expect(validateSNSMessageMock).toHaveBeenCalledTimes(2);
    expect(validateSNSMessageMock).toHaveBeenCalledWith(TEST_USER_DATA);
    expect(sendRequestMock).toHaveBeenCalledTimes(2);
    expect(sendRequestMock).toHaveBeenCalledWith(TEST_USER_DATA);
  });

  test("that it does not throw an error if axios returns a successful response", async () => {
    mockedAxios.delete.mockResolvedValue({
      data: {},
      status: 200,
      statusText: "OK",
    });
    await expect(handler(TEST_SNS_EVENT)).resolves.not.toThrowError();
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
        await handler(TEST_SNS_EVENT);
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
    expect(getRequestConfig("token")).toEqual({
      headers: { Authorization: "Bearer token" },
      proxy: false,
    });
  });
});

describe("sendRequest", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    process.env.GOV_ACCOUNTS_PUBLISHING_API_TOKEN = "TOKEN";
    process.env.MOCK_PUBLISHING_API_URL = "https://test.com";
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("that the URL will contain a query parameter if legacy_subject_id is true", async () => {
    await sendRequest(TEST_USER_DATA);
    expect(mockedAxios.delete).toHaveBeenCalledWith(
      "https://test.com/api/oidc-users/public_subject_id?legacy_sub=legacy_subject_id",
      { headers: { Authorization: "Bearer TOKEN" }, proxy: false }
    );
  });

  test("that the URL will only contain a path parameter, the public_subject_id, if legacy_subject_id is false", async () => {
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

  test("that it will return the response returned by axios when the request is successful", async () => {
    const mockResponse = {
      data: {},
      status: 200,
      statusText: "OK",
    } as AxiosResponse;
    mockedAxios.delete.mockResolvedValue(mockResponse);
    const response = await sendRequest(TEST_USER_DATA);
    expect(mockedAxios.delete).toHaveBeenCalledTimes(1);
    expect(response).toEqual({ data: {}, status: 200, statusText: "OK" });
  });
});

describe("validateSNSMessage", () => {
  test("that it doesn't throw an error when the SNS message is valid", () => {
    expect(validateSNSMessage(TEST_USER_DATA)).toBe(TEST_USER_DATA);
  });

  test("that it throws an error when the SNS message is missing the required attribute 'public_subject_id'", () => {
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

  test("that it doesn't throw an error when the SNS message is missing the non-required attribute 'legacy_subject_id'", () => {
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
