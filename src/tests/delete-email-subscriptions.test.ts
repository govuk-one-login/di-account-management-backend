import { Context } from "aws-lambda";
import { TEST_SNS_EVENT, TEST_USER_DATA } from "./testFixtures";
const mockLogger = {
  error: jest.fn(),
  info: jest.fn(),
  addContext: jest.fn(),
};

jest.mock("@aws-lambda-powertools/logger", () => ({
  Logger: jest.fn(() => mockLogger),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

import {
  handler,
  getRequestConfig,
  validateUserData,
  deleteEmailSubscription,
} from "../delete-email-subscriptions";

describe("handler", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    process.env.AWS_REGION = "AWS_REGION";
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("that it successfully processes the SNS message", async () => {
    const module = require("../delete-email-subscriptions");
    const validateUserDataMock = jest
      .spyOn(module, "validateUserData")
      .mockReturnValueOnce("validateUserData-mock");

    const deleteEmailSubscriptionMock = jest
      .spyOn(module, "deleteEmailSubscription")
      .mockReturnValue("deleteEmailSubscription-mock");

    await expect(handler(TEST_SNS_EVENT, {} as Context)).resolves.not.toThrow();
    expect(validateUserDataMock).toHaveBeenCalledTimes(1);
    expect(validateUserDataMock).toHaveBeenCalledWith(TEST_USER_DATA);
    expect(deleteEmailSubscriptionMock).toHaveBeenCalledTimes(1);
    expect(deleteEmailSubscriptionMock).toHaveBeenCalledWith(TEST_USER_DATA);
  });
});

describe("getRequestConfig", () => {
  test("that it returns the request config in the correct format", () => {
    expect(getRequestConfig("TOKEN")).toEqual({
      headers: { Authorization: "Bearer TOKEN" },
      method: "DELETE",
    });
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
    }).toThrow(`userData is not valid`);
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

describe("deleteEmailSubscription", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    process.env.GOV_ACCOUNTS_PUBLISHING_API_TOKEN = "test-token";
    process.env.GOV_ACCOUNTS_PUBLISHING_API_URL = "https://api.example.com";
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("successfully deletes email subscription", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    await expect(
      deleteEmailSubscription(TEST_USER_DATA)
    ).resolves.not.toThrow();
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/api/oidc-users/public_subject_id/?legacy_sub=legacy_subject_id",
      { headers: { Authorization: "Bearer test-token" }, method: "DELETE" }
    );
  });

  test("handles 404 response without throwing", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });

    await expect(
      deleteEmailSubscription(TEST_USER_DATA)
    ).resolves.not.toThrow();
  });

  test("throws and logs error for non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    await expect(deleteEmailSubscription(TEST_USER_DATA)).rejects.toThrow(
      "Unable to send DELETE request to GOV.UK API. Status code : 500"
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      "Unable to send DELETE request to GOV.UK API. Status code : 500"
    );
  });

  test("constructs URL without legacy_subject_id when not present", async () => {
    const userData = { ...TEST_USER_DATA, legacy_subject_id: undefined };
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    await deleteEmailSubscription(userData);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/api/oidc-users/public_subject_id",
      { headers: { Authorization: "Bearer test-token" }, method: "DELETE" }
    );
  });
});
