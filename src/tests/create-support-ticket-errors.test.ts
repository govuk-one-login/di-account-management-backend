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
  let consoleErrorMock: jest.SpyInstance;

  beforeEach(() => {
    mockAxios.reset();
    mockedSecretsManager.reset();
    process.env.DLQ_URL = "DLQ_URL";
    process.env.ZENDESK_GROUP_ID_KEY = "zendesk_group_id_key";
    process.env.ZENDESK_TAGS_KEY = "zendesk_tags_key";
    process.env.ZENDESK_API_TOKEN_KEY = "zendesk_api_token_key";
    process.env.ZENDESK_API_USER_KEY = "zendesk_api_user_key";
    process.env.ZENDESK_API_URL_KEY = "zendesk_api_url";
    process.env.ZENDESK_TICKET_FORM_ID = "zendesk_ticket_form_id";
    process.env.ACTIVITY_LOG_TABLE = "activity_log_table";
    consoleErrorMock = jest.spyOn(global.console, "error").mockImplementation();
  });
  afterEach(() => {
    consoleErrorMock.mockRestore();
    jest.clearAllMocks();
  });

  test("throw error when required environment variables not provided", async () => {
    delete process.env.ZENDESK_API_TOKEN_KEY;
    delete process.env.ZENDESK_API_USER_KEY;
    delete process.env.ZENDESK_GROUP_ID_KEY;
    delete process.env.ZENDESK_TAGS_KEY;
    delete process.env.ZENDESK_API_USER_KEY;
    delete process.env.ACTIVITY_LOG_TABLE;
    let errorThrown = false;
    try {
      await handler(testSuspiciousActivityInput);
    } catch (error) {
      errorThrown = true;
    }
    expect(consoleErrorMock).toHaveBeenCalledTimes(1);
    expect(consoleErrorMock.mock.calls[0][0]).toContain(
      "[Error occurred], unable to send suspicious activity event with ID: 522c5ab4-7e66-4b2a-8f5c-4d31dc4e93e6 to Zendesk, Not all environment variables required to successfully send to Zendesk are provided."
    );
    expect(errorThrown).toBeTruthy();
  });

  test("Generate an error when event validation fails", async () => {
    testSuspiciousActivityInput.event_type = "another";
    let errorThrown = false;
    try {
      await handler(testSuspiciousActivityInput);
    } catch (error) {
      errorThrown = true;
    }
    expect(consoleErrorMock).toHaveBeenCalledTimes(1);
    expect(consoleErrorMock.mock.calls[0][0]).toContain(
      "Error occurred], unable to send suspicious activity event with ID: 522c5ab4-7e66-4b2a-8f5c-4d31dc4e93e6 to Zendesk, Could not validate Suspicious Event Body"
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
    try {
      await handler(testSuspiciousActivityInput);
    } catch (error) {
      errorThrown = true;
    }
    expect(consoleErrorMock).toHaveBeenCalledTimes(1);
    expect(consoleErrorMock.mock.calls[0][0]).toContain(
      "[Error occurred], unable to send suspicious activity event with ID: 522c5ab4-7e66-4b2a-8f5c-4d31dc4e93e6 to Zendesk, SomeSecretsManagerError"
    );
    expect(errorThrown).toBeTruthy();
  });

  test("Generate an error when any of the secret value is not configured", async () => {
    mockedSecretsManager.on(GetSecretValueCommand).resolves({
      SecretString: undefined,
    });
    let errorThrown = false;
    try {
      await handler(testSuspiciousActivityInput);
    } catch (error) {
      errorThrown = true;
    }
    expect(consoleErrorMock).toHaveBeenCalledTimes(1);
    expect(consoleErrorMock.mock.calls[0][0]).toContain(
      "[Error occurred], unable to send suspicious activity event with ID: 522c5ab4-7e66-4b2a-8f5c-4d31dc4e93e6 to Zendesk, Required zendesk secrets not configured"
    );
    expect(errorThrown).toBeTruthy();
  });

  test("Generate an error when call to mock axios instance throws error", async () => {
    mockedSecretsManager.on(GetSecretValueCommand).resolves({
      SecretString: "111111111",
    });
    let errorThrown = false;
    try {
      await handler(testSuspiciousActivityInput);
    } catch (error) {
      errorThrown = true;
    }
    expect(consoleErrorMock).toHaveBeenCalledTimes(1);
    expect(consoleErrorMock.mock.calls[0][0]).toContain(
      '[Error occurred], unable to send suspicious activity event with ID: 522c5ab4-7e66-4b2a-8f5c-4d31dc4e93e6 to Zendesk, 404 undefined - creating ticket: {"ticket":{"subject":"One Login Home - Report Suspicious Activity","comment":{"html_body":"<p><strong>Event Name</strong>: TXMA_EVENT</p><p><strong>Event ID</strong>: ab12345a-a12b-3ced-ef12-12a3b4cd5678</p><p><strong>Reported Date and Time</strong>: Fri, 02 Jan 1970 10:17:36 GMT</p><p><strong>Client ID</strong>: gov-uk</p><p><strong>User ID</strong>: qwerty</p><p><strong>Session ID</strong>: 123456789</p>"},"group_id":111111111,"requester":{"email":"email","name":"email"},"tags":["111111111"],"ticket_form_id":111111111}}'
    );
    expect(errorThrown).toBeTruthy();
  });
});
