import dotenv from "dotenv";
dotenv.config({ path: ".env.test" });
import { handler, validateUserData } from "../delete-email-subscriptions";
import { TEST_SNS_EVENT, TEST_USER_DATA } from "./testFixtures";

global.fetch = jest.fn();

describe("handler", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    (fetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    process.env = OLD_ENV;
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

    await expect(handler(TEST_SNS_EVENT)).resolves.not.toThrow();
    expect(validateUserDataMock).toHaveBeenCalledTimes(1);
    expect(validateUserDataMock).toHaveBeenCalledWith(TEST_USER_DATA);
    expect(deleteEmailSubscriptionMock).toHaveBeenCalledTimes(1);
    expect(deleteEmailSubscriptionMock).toHaveBeenCalledWith(TEST_USER_DATA);
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
