import { AxiosRequestConfig } from "axios";
import {
  getRequestConfig,
  userIDPayload,
  validatePayload,
} from "../delete-email-subscriptions";
import { TEST_USER_DATA, TEST_SNS_EVENT } from "./test-helpers";

describe("getRequestConfig", () => {
  test("that the token takes in a string", () => {
    expect(getRequestConfig("hello")).toEqual({
      headers: {
        Authorization: `Bearer hello`,
      },
      proxy: false,
    });
  });
});

describe("validatePayload", () => {
  test("that it doesn't throw an error when the SNS message is valid", () => {
    expect(validatePayload(TEST_USER_DATA)).toBe(TEST_USER_DATA);
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
      validatePayload(snsMessage);
    }).toThrowError(
      'Payload is missing required attribute "public_subject_id".'
    );
  });

  test("that it throws an error when the SNS message is missing the required attribute 'user_id'", () => {
    const snsMessage = JSON.parse(
      JSON.stringify({
        access_token: "access_token",
        email: "email",
        source_ip: "source_ip",
        persistent_session_id: "persistent_session_id",
        session_id: "session_id",
        public_subject_id: "string",
        legacy_subject_id: "legacy_subject_id",
      })
    );
    expect(() => {
      userIDPayload(snsMessage);
    }).toThrowError('Payload is missing required attribute "user_id".');
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
    expect(validatePayload(snsMessage)).toBe(snsMessage);
  });
});
