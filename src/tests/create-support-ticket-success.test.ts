import "aws-sdk-client-mock-jest";
import { mockClient } from "aws-sdk-client-mock";
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import MockAdapter from "axios-mock-adapter";
import axios from "axios";
import { handler, formatCommentBody } from "../create-support-ticket";
import {
  eventId,
  tableName,
  testSuspiciousActivityInput,
  userId,
} from "./testFixtures";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const mockedSecretsManager = mockClient(SecretsManagerClient);
const mockAxios = new MockAdapter(axios);
const dynamoMock = mockClient(DynamoDBDocumentClient);

describe("Generate zendesk ticket Body", () => {
  test("should generate ticket body successfully using the suspicious activity event", async () => {
    const expected =
      "<p><strong>Requester</strong>: email</p><p><strong>Event Name</strong>: TXMA_EVENT</p><p><strong>Event ID</strong>: ab12345a-a12b-3ced-ef12-12a3b4cd5678</p><p><strong>Reported Date and Time</strong>: Thu, 29 Nov 1973 21:33:09 GMT</p><p><strong>Client ID</strong>: govuk</p><p><strong>User ID</strong>: qwerty</p><p><strong>Session ID</strong>: 123456789</p>";
    const result = formatCommentBody(testSuspiciousActivityInput);
    expect(result).toEqual(expected);
  });
});

describe("handler", () => {
  beforeEach(() => {
    mockedSecretsManager.reset();
    mockAxios.reset();
    process.env.ZENDESK_GROUP_ID_KEY = "zendesk_group_id_key";
    process.env.ZENDESK_TAGS_KEY = "zendesk_tags_key";
    process.env.ZENDESK_API_TOKEN_KEY = "zendesk_api_token_key";
    process.env.ZENDESK_API_USER_KEY = "zendesk_api_user_key";
    process.env.ZENDESK_API_URL_KEY = "zendesk_api_url";
    process.env.ZENDESK_TICKET_FORM_ID = "zendesk_ticket_form_id";
    process.env.ACTIVITY_LOG_TABLE = tableName;
    dynamoMock.reset();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test("handler successfully sends suspicious event to zendesk and tags", async () => {
    mockedSecretsManager.on(GetSecretValueCommand).resolves({
      SecretString: "1111111",
    });
    const expectedBody = {
      ticket: {
        id: 123456789,
        subject: "One Login Home - Report Suspicious Activity",
        comment: {
          html_body:
            "<p><strong>Requester</strong>: email</p><p><strong>Event Name</strong>: TXMA_EVENT</p><p><strong>Event ID</strong>: ab12345a-a12b-3ced-ef12-12a3b4cd5678</p><p><strong>Reported Date and Time</strong>: Fri, 02 Jan 1970 10:17:36 GMT</p><p><strong>Client ID</strong>: govuk</p><p><strong>User ID</strong>: qwerty</p><p><strong>Session ID</strong>: 123456789</p>",
        },
        group_id: 1111111,
        tags: ["1111111"],
        ticket_form_id: 1111111,
      },
    };
    mockAxios.onAny().reply(201, expectedBody);
    const response = await handler(testSuspiciousActivityInput);
    expect(mockAxios.history.post.length).toBe(1);
    const authHeader =
      mockAxios?.history?.post[0]?.headers?.Authorization.split("Basic")[1];
    const bufferedString = Buffer.from(authHeader, "base64").toString("utf-8");
    expect(bufferedString).toEqual("1111111/token:1111111");
    expect(dynamoMock.commandCalls(UpdateCommand).length).toEqual(1);
    expect(dynamoMock).toHaveReceivedCommandWith(UpdateCommand, {
      TableName: tableName,
      Key: {
        user_id: userId,
        event_id: eventId,
      },
      UpdateExpression: "set zendesk_ticket_number = :zendesk_ticket_number",
      ExpressionAttributeValues: {
        ":zendesk_ticket_number": "123456789",
      },
    });
    expect(response).toEqual({
      event_id: "522c5ab4-7e66-4b2a-8f5c-4d31dc4e93e6",
      event_type: "HOME_REPORT_SUSPICIOUS_ACTIVITY",
      session_id: "session_id",
      persistent_session_id: "persistent_session_id",
      email_address: "email",
      component_id: "https://home.account.gov.uk",
      timestamp: 1708971886,
      event_timestamp_ms: 1708971886515,
      event_timestamp_ms_formatted: "2024-02-26T18:24:46.515Z",
      timestamp_formatted: "2024-02-26T18:24:46.515Z",
      suspicious_activity: {
        event_type: "TXMA_EVENT",
        session_id: "123456789",
        user_id: "qwerty",
        timestamp: 123456789,
        client_id: "govuk",
        event_id: "ab12345a-a12b-3ced-ef12-12a3b4cd5678",
        reported_suspicious: true,
      },
      zendesk_ticket_id: "123456789",
    });
  });

  test("handler successfully sends suspicious event to zendesk and no tags", async () => {
    delete process.env.ZENDESK_TAGS_KEY;
    mockedSecretsManager.on(GetSecretValueCommand).resolves({
      SecretString: "1111111",
    });
    const expectedBody = {
      ticket: {
        id: 123456789,
        subject: "One Login Home - Report Suspicious Activity",
        comment: {
          html_body:
            "<p><strong>Requester</strong>: email</p><p><strong>Event Name</strong>: TXMA_EVENT</p><p><strong>Event ID</strong>: ab12345a-a12b-3ced-ef12-12a3b4cd5678</p><p><strong>Reported Date and Time</strong>: Fri, 02 Jan 1970 10:17:36 GMT</p><p><strong>Client ID</strong>: govuk</p><p><strong>User ID</strong>: qwerty</p><p><strong>Session ID</strong>: 123456789</p>",
        },
        group_id: 1111111,
        ticket_form_id: 1111111,
      },
    };
    mockAxios.onAny().reply(201, expectedBody);
    await handler(testSuspiciousActivityInput);
    expect(mockAxios.history.post.length).toBe(1);
    expect(dynamoMock.commandCalls(UpdateCommand).length).toEqual(1);
    expect(dynamoMock).toHaveReceivedCommandWith(UpdateCommand, {
      TableName: tableName,
      Key: {
        user_id: userId,
        event_id: eventId,
      },
      UpdateExpression: "set zendesk_ticket_number = :zendesk_ticket_number",
      ExpressionAttributeValues: {
        ":zendesk_ticket_number": "123456789",
      },
    });
  });
});
