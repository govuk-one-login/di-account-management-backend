import { validatePayload, getRequestConfig } from "../delete-one-login-account";
import { TEST_USER_DATA } from "./test-helpers";

describe("getRequestConfig", () => {
  test("that the token takes in a string", () => {
    expect(getRequestConfig("hello")).toEqual({
      headers: {
        Authorization: `Bearer hello`,
      },
      proxy: false,
    });
  });
  test("This getRequestConfig has properties: headers and proxy", () => {
    expect(getRequestConfig("hello")).toHaveProperty("headers");
    expect(getRequestConfig("hello")).toHaveProperty("proxy", false);
    expect(getRequestConfig("hello")).not.toHaveProperty("pool");
  });
  test("Checking the header for persistentSessionId is di-persistent-session-id", () => {
    expect(getRequestConfig("hello", "world", "persistent123")).toEqual({
      headers: {
        Authorization: `Bearer hello`,
        "X-Forwarded-For": "world",
        "di-persistent-session-id": "persistent123",
      },
      proxy: false,
    });
  });
  test("Checking the header for sessionId is Session-Id", () => {
    expect(
      getRequestConfig("hello", "world", "persistent123", "session123")
    ).toEqual({
      headers: {
        Authorization: `Bearer hello`,
        "X-Forwarded-For": "world",
        "di-persistent-session-id": "persistent123",
        "Session-Id": "session123",
      },
      proxy: false,
    });
  });
  test("Checking the header exists for sourceIp", () => {
    expect(getRequestConfig("hello", "world")).toEqual({
      headers: {
        Authorization: `Bearer hello`,
        "X-Forwarded-For": "world",
      },
      proxy: false,
    });
  });
  // test("An error is thrown when the getRequestConfig does not have an access Token", () => {
  //   const requestBody = JSON.parse(
  //     JSON.stringify({
  //       sourceIp: "sourceIp",
  //       persistentSessionId: "persistentSessionId",
  //       sessionId: "sessionId",
  //     })
  //   );
  //   expect(() => {
  //     getRequestConfig(requestBody);
  //   }).toThrowError("Request Body is missing an access Token.");
  // });
});

describe("validatePayload", () => {
  test("that it doesn't throw an error when the SNS message is valid", () => {
    expect(validatePayload(TEST_USER_DATA)).toBe(TEST_USER_DATA);
  });

  test("An error is thrown when the SNS message is missing either the 'email' or 'access_token' attribute", () => {
    const snsMessage = JSON.parse(
      JSON.stringify({
        user_id: "user-id",
        source_ip: "source_ip",
        persistent_session_id: "persistent_session_id",
        session_id: "session_id",
        public_subject_id: "public_subject_id",
        legacy_subject_id: "legacy_subject_id",
      })
    );
    expect(() => {
      validatePayload(snsMessage);
    }).toThrowError(
      'Payload is missing one or both of the required attributes "email" and "access_token".'
    );
  });

  test("Check that an error is not thrown when the SNS message is missing a non-required attribute", () => {
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
