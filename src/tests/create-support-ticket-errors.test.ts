import dotenv from "dotenv";
dotenv.config({ path: ".env.test" });
import "aws-sdk-client-mock-jest";
import { mockClient } from "aws-sdk-client-mock";
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import MockAdapter from "axios-mock-adapter";
import axios from "axios";
import { handler } from "../create-support-ticket";
import { testSuspiciousActivityInput } from "./testFixtures";
import { EventNamesEnum } from "../common/constants";

const mockedSecretsManager = mockClient(SecretsManagerClient);
const mockAxios = new MockAdapter(axios);

describe("handler error handling", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    mockAxios.reset();
    mockedSecretsManager.reset();
  });

  afterEach(() => {
    process.env = OLD_ENV;
    jest.clearAllMocks();
  });

  test("throw error when required environment variables not provided", async () => {
    delete process.env.ZENDESK_GROUP_ID_KEY;
    let errorThrown = false;
    let errorMessage = "";
    try {
      await handler(testSuspiciousActivityInput);
    } catch (error) {
      errorThrown = true;
      errorMessage = (error as Error).message;
    }
    expect(errorThrown).toBeTruthy();
    expect(errorMessage).toContain(
      "Unable to send suspicious activity event with ID: 522c5ab4-7e66-4b2a-8f5c-4d31dc4e93e6 to Zendesk, Cannot read properties of undefined (reading 'SecretString')"
    );
  });

  test("Generate an error when event validation fails", async () => {
    testSuspiciousActivityInput.event_type = "another";
    let errorThrown = false;
    let errorMessage = "";
    try {
      await handler(testSuspiciousActivityInput);
    } catch (error) {
      errorThrown = true;
      errorMessage = (error as Error).message;
    }
    expect(errorMessage).toContain(
      "Unable to send suspicious activity event with ID: 522c5ab4-7e66-4b2a-8f5c-4d31dc4e93e6 to Zendesk, Could not validate Suspicious Event Body"
    );
    expect(errorThrown).toBeTruthy();
    testSuspiciousActivityInput.event_type =
      EventNamesEnum.HOME_REPORT_SUSPICIOUS_ACTIVITY;
  });

  test("Generate an error when call to mock get secret throws error", async () => {
    mockedSecretsManager
      .on(GetSecretValueCommand)
      .rejects("SomeSecretsManagerError");
    let errorThrown = false;
    let errorMessage = "";
    try {
      await handler(testSuspiciousActivityInput);
    } catch (error) {
      errorThrown = true;
      errorMessage = (error as Error).message;
    }
    expect(errorMessage).toContain(
      "Unable to send suspicious activity event with ID: 522c5ab4-7e66-4b2a-8f5c-4d31dc4e93e6 to Zendesk, SomeSecretsManagerError"
    );
    expect(errorThrown).toBeTruthy();
  });

  test("Generate an error when any of the secret value is not configured", async () => {
    mockedSecretsManager.on(GetSecretValueCommand).resolves({
      SecretString: undefined,
    });
    let errorThrown = false;
    let errorMessage = "";
    try {
      await handler(testSuspiciousActivityInput);
    } catch (error) {
      errorThrown = true;
      errorMessage = (error as Error).message;
    }
    expect(errorMessage).toContain(
      "Unable to send suspicious activity event with ID: 522c5ab4-7e66-4b2a-8f5c-4d31dc4e93e6 to Zendesk, Required zendesk secrets not configured"
    );
    expect(errorThrown).toBeTruthy();
  });

  test("Generate an error when call to mock axios instance throws error", async () => {
    mockedSecretsManager.on(GetSecretValueCommand).resolves({
      SecretString: "111111111",
    });
    let errorThrown = false;
    let errorMessage = "";
    try {
      await handler(testSuspiciousActivityInput);
    } catch (error) {
      errorThrown = true;
      errorMessage = (error as Error).message;
    }
    expect(errorMessage).toContain(
      "Unable to send suspicious activity event with ID: 522c5ab4-7e66-4b2a-8f5c-4d31dc4e93e6 to Zendesk, 404 undefined"
    );
    expect(errorThrown).toBeTruthy();
  });
});
