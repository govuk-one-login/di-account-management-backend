import "aws-sdk-client-mock-jest";
import { mockClient } from "aws-sdk-client-mock";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import MockAdapter from "axios-mock-adapter";
import axios from "axios";
import { handler } from "../create-support-ticket";
import {
  createSnsEvent,
  TEST_SNS_EVENT,
  testSuspiciousActivityEvent,
} from "./testFixtures";

const sqsMock = mockClient(SQSClient);
const mockedSecretsManager = mockClient(SecretsManagerClient);
const mockAxios = new MockAdapter(axios);

describe("handler error handling", () => {
  let consoleErrorMock: jest.SpyInstance;

  beforeEach(() => {
    sqsMock.reset();
    mockAxios.reset();
    mockedSecretsManager.reset();
    process.env.DLQ_URL = "DLQ_URL";
    process.env.ZENDESK_GROUP_ID_KEY = "zendesk_group_id_key";
    process.env.ZENDESK_TAGS_KEY = "zendesk_tags_key";
    process.env.ZENDESK_API_TOKEN_KEY = "zendesk_api_token_key";
    process.env.ZENDESK_API_USER_KEY = "zendesk_api_user_key";
    process.env.ZENDESK_API_URL_KEY = "zendesk_api_url";
    consoleErrorMock = jest.spyOn(global.console, "error").mockImplementation();
    sqsMock.on(SendMessageCommand).resolves({ MessageId: "MessageId" });
  });
  afterEach(() => {
    consoleErrorMock.mockRestore();
    jest.clearAllMocks();
  });

  test("send message to DLQ when required environment variables not provided", async () => {
    delete process.env.ZENDESK_API_TOKEN_KEY;
    delete process.env.ZENDESK_API_USER_KEY;
    delete process.env.ZENDESK_GROUP_ID_KEY;
    delete process.env.ZENDESK_TAGS_KEY;
    delete process.env.ZENDESK_API_USER_KEY;
    await handler(createSnsEvent(testSuspiciousActivityEvent));
    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(1);
    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl: "DLQ_URL",
      MessageBody: JSON.stringify(testSuspiciousActivityEvent),
    });
    expect(consoleErrorMock).toHaveBeenCalledTimes(2);
    expect(consoleErrorMock.mock.calls[0][0]).toContain(
      "[Error occurred], unable to send suspicious activity event with ID: event_id to Zendesk, Not all environment variables required to successfully send to Zendesk are provided."
    );
  });

  test("send message to DLQ when event validation fails", async () => {
    await handler(
      createSnsEvent({
        event_id: "event_id",
      })
    );
    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(1);
    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl: "DLQ_URL",
      MessageBody: JSON.stringify({
        event_id: "event_id",
      }),
    });
    expect(consoleErrorMock).toHaveBeenCalledTimes(2);
    expect(consoleErrorMock.mock.calls[0][0]).toContain(
      "[Error occurred], unable to send suspicious activity event with ID: event_id to Zendesk, Could not validate Suspicious Event Body"
    );
    TEST_SNS_EVENT.Records[0].Sns.Message = JSON.stringify({
      event_id: "event_id",
    });
  });

  test("send message to DLQ when call to mock get secret throws error", async () => {
    mockedSecretsManager
      .on(GetSecretValueCommand)
      .rejects("SomeSecretsManagerError");
    await handler(createSnsEvent(testSuspiciousActivityEvent));
    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(1);
    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl: "DLQ_URL",
      MessageBody: JSON.stringify(testSuspiciousActivityEvent),
    });
    expect(consoleErrorMock).toHaveBeenCalledTimes(2);
    expect(consoleErrorMock.mock.calls[0][0]).toContain(
      "[Error occurred], unable to send suspicious activity event with ID: event_id to Zendesk, SomeSecretsManagerError"
    );
  });

  test("send message to DLQ when any of the secret value is not configured", async () => {
    mockedSecretsManager.on(GetSecretValueCommand).resolves({
      SecretString: undefined,
    });
    await handler(createSnsEvent(testSuspiciousActivityEvent));
    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(1);
    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl: "DLQ_URL",
      MessageBody: JSON.stringify(testSuspiciousActivityEvent),
    });
    expect(consoleErrorMock).toHaveBeenCalledTimes(2);
    expect(consoleErrorMock.mock.calls[0][0]).toContain(
      "[Error occurred], unable to send suspicious activity event with ID: event_id to Zendesk, Required zendesk secrets not configured"
    );
  });

  test("send message to DLQ when call to mock axios instance throws error", async () => {
    mockedSecretsManager.on(GetSecretValueCommand).resolves({
      SecretString: "111111111",
    });
    await handler(createSnsEvent(testSuspiciousActivityEvent));
    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(1);
    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl: "DLQ_URL",
      MessageBody: JSON.stringify(testSuspiciousActivityEvent),
    });
    expect(consoleErrorMock).toHaveBeenCalledTimes(2);
    expect(consoleErrorMock.mock.calls[0][0]).toContain(
      '[Error occurred], unable to send suspicious activity event with ID: event_id to Zendesk, 404 undefined - creating ticket: {"ticket":{"subject":"REPORT_SUSPICIOUS_ACTIVITY -OLH TEST IGNORE","comment":{"html_body":"<p><strong>Event Name</strong>: event_name</p><p><strong>Event ID</strong>: event_id</p><p><strong>Client ID</strong>: client_id</p><p><strong>Date and Time</strong>: Fri, 01 Jan 2021 01:01:01 GMT</p><p><strong>User ID</strong>: user_id</p><p><strong>Session ID</strong>: session_id</p><p><strong>Gov UK Sign-in Journey ID</strong>: govuk_signin_journey_id</p>"},"group_id":111111111,"tags":["111111111"]}}'
    );
  });
});
