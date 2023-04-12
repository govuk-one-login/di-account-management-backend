import axios from "axios";
import {
  handler,
  deleteEmailSubscription,
  getRequestConfig,
  validateUserData,
} from "../delete-email-subscriptions";
import { TEST_USER_DATA, TEST_SNS_EVENT } from "./test-helpers";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("handler", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("that it successfully processes the SNS message", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires,global-require
    const module = require("../delete-email-subscriptions");
    const validateUserDataMock = jest
      .spyOn(module, "validateUserData")
      .mockReturnValueOnce("validateUserData-mock");

    const deleteEmailSubscriptionMock = jest
      .spyOn(module, "deleteEmailSubscription")
      .mockReturnValue("deleteEmailSubscription-mock");

    await expect(handler(TEST_SNS_EVENT)).resolves.not.toThrowError();
    expect(validateUserDataMock).toHaveBeenCalledTimes(1);
    expect(validateUserDataMock).toHaveBeenCalledWith(TEST_USER_DATA);
    expect(deleteEmailSubscriptionMock).toHaveBeenCalledTimes(1);
    expect(deleteEmailSubscriptionMock).toHaveBeenCalledWith(TEST_USER_DATA);
  });

  test("that it does not throw an error if axios returns a successful response", async () => {
    mockedAxios.delete.mockResolvedValue({
      status: 204,
      statusText: "No Content",
    });
    await expect(handler(TEST_SNS_EVENT)).resolves.not.toThrowError();
  });

  describe("handler error handling", () => {
    let consoleErrorMock: jest.SpyInstance;

    beforeEach(() => {
      consoleErrorMock = jest.spyOn(console, "error").mockImplementation();
      mockedAxios.delete.mockRejectedValueOnce(new Error("error"));
    });

    afterEach(() => {
      consoleErrorMock.mockClear();
    });

    test("that it throws an error if axios throws an error", async () => {
      await expect(async () => {
        await handler(TEST_SNS_EVENT);
      }).rejects.toThrowError();
      expect(consoleErrorMock).toHaveBeenCalledTimes(2);
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

describe("deleteEmailSubscription", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockedAxios.delete.mockResolvedValue({
      status: 204,
      statusText: "No Content",
    });
    process.env.GOV_ACCOUNTS_PUBLISHING_API_URL = "https://test.com";
    process.env.GOV_ACCOUNTS_PUBLISHING_API_TOKEN = "TOKEN";
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("that the URL contains a query parameter if legacy_subject_id is truthy", async () => {
    await deleteEmailSubscription(TEST_USER_DATA);
    expect(mockedAxios.delete).toHaveBeenCalledWith(
      "https://test.com/api/oidc-users/public_subject_id?legacy_sub=legacy_subject_id",
      { headers: { Authorization: "Bearer TOKEN" }, proxy: false }
    );
  });

  test("that the URL does not contain a query parameter if legacy_subject_id is falsy", async () => {
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
    await deleteEmailSubscription(snsMessage);
    expect(mockedAxios.delete).toHaveBeenCalledWith(
      "https://test.com/api/oidc-users/public_subject_id",
      { headers: { Authorization: "Bearer TOKEN" }, proxy: false }
    );
  });

  test("that it returns the response object if axios returns a successful response", async () => {
    const response = await deleteEmailSubscription(TEST_USER_DATA);
    expect(mockedAxios.delete).toHaveBeenCalledTimes(1);
    expect(response).toEqual({ status: 204, statusText: "No Content" });
  });
});

describe("validateUserData", () => {
  test("that it does not throw an error when the SNS message is valid", () => {
    expect(validateUserData(TEST_USER_DATA)).toBe(TEST_USER_DATA);
  });

  test("that it throws an error if the SNS message is missing the required attribute public_subject_id", () => {
    const userData = JSON.parse(
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
      validateUserData(userData);
    }).toThrowError(`userData is not valid : ${JSON.stringify(userData)}`);
  });

  test("that it does not throw an error if the SNS message is missing the non-required attribute legacy_subject_id", () => {
    const userData = JSON.parse(
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
    expect(validateUserData(userData)).toBe(userData);
  });
});
