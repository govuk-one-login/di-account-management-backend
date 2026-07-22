import { vi, describe, test, expect, beforeEach, afterEach } from "vitest";
import { Context } from "aws-lambda";
import { TEST_SNS_EVENT, TEST_USER_DATA } from "./testFixtures.js";

const mockLogger = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  addContext: vi.fn(),
}));

vi.mock("@aws-lambda-powertools/logger", () => ({
  Logger: class {
    warn = mockLogger.warn;
    error = mockLogger.error;
    info = mockLogger.info;
    addContext = mockLogger.addContext;
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const validateUserDataMock = vi.hoisted(() => vi.fn());
const deleteEmailSubscriptionMock = vi.hoisted(() => vi.fn());

vi.mock("../delete-email-subscriptions-utils.js", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../delete-email-subscriptions-utils.js")
    >();
  return {
    ...actual,
    validateUserData: validateUserDataMock.mockImplementation(
      actual.validateUserData
    ),
    deleteEmailSubscription: deleteEmailSubscriptionMock.mockImplementation(
      actual.deleteEmailSubscription
    ),
  };
});

import { handler } from "../delete-email-subscriptions.js";
import {
  getRequestConfig,
  validateUserData,
  deleteEmailSubscription,
} from "../delete-email-subscriptions-utils.js";

describe("handler", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
    validateUserDataMock.mockImplementation((data) => data);
    deleteEmailSubscriptionMock.mockResolvedValue(undefined);
    process.env.AWS_REGION = "AWS_REGION";
    process.env.GOV_ACCOUNTS_PUBLISHING_API_TOKEN = "test-token";
    process.env.GOV_ACCOUNTS_PUBLISHING_API_URL = "https://api.example.com";
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  test("that it successfully processes the SNS message", async () => {
    await expect(handler(TEST_SNS_EVENT, {} as Context)).resolves.not.toThrow();
    expect(validateUserDataMock).toHaveBeenCalledTimes(1);
    expect(validateUserDataMock).toHaveBeenCalledWith(TEST_USER_DATA);
    expect(deleteEmailSubscriptionMock).toHaveBeenCalledTimes(1);
    expect(deleteEmailSubscriptionMock).toHaveBeenCalledWith(TEST_USER_DATA);
  });

  test("that it retries up to 3 times total when deleteEmailSubscription throws error", async () => {
    vi.mocked(deleteEmailSubscriptionMock).mockRejectedValue(
      new Error("deleteEmailSubscription FAIL"),
    );
    await expect(handler(TEST_SNS_EVENT, {} as Context)).rejects.toThrow("deleteEmailSubscription FAIL");
    expect(deleteEmailSubscriptionMock).toHaveBeenCalledTimes(3);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "deleteEmailSubscription failed (attempt 1 out of 3)."
    );

    expect(mockLogger.warn).toHaveBeenCalledWith(
      "deleteEmailSubscription failed (attempt 2 out of 3)."
    );

    expect(mockLogger.warn).toHaveBeenCalledWith(
      "deleteEmailSubscription failed (attempt 3 out of 3)."
    );
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
  beforeEach(async () => {
    const actual = await vi.importActual<
      typeof import("../delete-email-subscriptions-utils.js")
    >("../delete-email-subscriptions-utils.js");
    validateUserDataMock.mockImplementation(actual.validateUserData);
  });

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
  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
    const actual = await vi.importActual<
      typeof import("../delete-email-subscriptions-utils.js")
    >("../delete-email-subscriptions-utils.js");
    deleteEmailSubscriptionMock.mockImplementation(
      actual.deleteEmailSubscription
    );
    process.env.GOV_ACCOUNTS_PUBLISHING_API_TOKEN = "test-token";
    process.env.GOV_ACCOUNTS_PUBLISHING_API_URL = "https://api.example.com";
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
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

  test("logs structured error details when fetch fails", async () => {
    const cause = new Error("connect ETIMEDOUT") as Error & { code?: string };
    cause.code = "ETIMEDOUT";
    const fetchError = new TypeError("fetch failed");
    fetchError.cause = cause;
    mockFetch.mockRejectedValue(fetchError);

    await expect(deleteEmailSubscription(TEST_USER_DATA)).rejects.toThrow(
      "fetch failed"
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      "Failed to fetch GOV.UK API",
      {
        errorName: "TypeError",
        errorMessage: "fetch failed",
        errorCauseCode: "ETIMEDOUT",
      }
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
