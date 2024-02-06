import "aws-sdk-client-mock-jest";
import { mockClient } from "aws-sdk-client-mock";
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import MockAdapter from "axios-mock-adapter";
import axios from "axios";
import { handler, formatCommentBody } from "../create-support-ticket";
import { createSnsEvent, testSuspiciousActivityEvent } from "./testFixtures";

const mockedSecretsManager = mockClient(SecretsManagerClient);
const mockAxios = new MockAdapter(axios);

describe("Generate zendesk ticket Body", () => {
  test("should generate ticket body successfully using the suspicious activity event", async () => {
    const expected =
      "<p><strong>Event Name</strong>: event_name</p><p><strong>Event ID</strong>: event_id</p><p><strong>Client ID</strong>: client_id</p><p><strong>Date and Time</strong>: Fri, 01 Jan 2021 01:01:01 GMT</p><p><strong>User ID</strong>: user_id</p><p><strong>Session ID</strong>: session_id</p><p><strong>Gov UK Sign-in Journey ID</strong>: govuk_signin_journey_id</p>";
    const result = formatCommentBody(testSuspiciousActivityEvent);
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
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test("handler successfully sends suspicious event to zendesk and tags", async () => {
    mockedSecretsManager.on(GetSecretValueCommand).resolves({
      SecretString: "1111111",
    });
    mockAxios.onAny().reply(200);
    const expectedBody = {
      ticket: {
        subject: "REPORT_SUSPICIOUS_ACTIVITY -OLH TEST IGNORE",
        comment: {
          html_body:
            "<p><strong>Event Name</strong>: event_name</p><p><strong>Event ID</strong>: event_id</p><p><strong>Client ID</strong>: client_id</p><p><strong>Date and Time</strong>: Fri, 01 Jan 2021 01:01:01 GMT</p><p><strong>User ID</strong>: user_id</p><p><strong>Session ID</strong>: session_id</p><p><strong>Gov UK Sign-in Journey ID</strong>: govuk_signin_journey_id</p>",
        },
        group_id: 1111111,
        tags: ["1111111"],
      },
    };
    await handler(createSnsEvent(testSuspiciousActivityEvent));
    expect(mockAxios.history.post.length).toBe(1);
    expect(mockAxios.history.post[0].data).toBe(JSON.stringify(expectedBody));
  });

  test("handler successfully sends suspicious event to zendesk and no tags", async () => {
    delete process.env.ZENDESK_TAGS_KEY;
    mockedSecretsManager.on(GetSecretValueCommand).resolves({
      SecretString: "1111111",
    });
    mockAxios.onAny().reply(200);
    const expectedBody = {
      ticket: {
        subject: "REPORT_SUSPICIOUS_ACTIVITY -OLH TEST IGNORE",
        comment: {
          html_body:
            "<p><strong>Event Name</strong>: event_name</p><p><strong>Event ID</strong>: event_id</p><p><strong>Client ID</strong>: client_id</p><p><strong>Date and Time</strong>: Fri, 01 Jan 2021 01:01:01 GMT</p><p><strong>User ID</strong>: user_id</p><p><strong>Session ID</strong>: session_id</p><p><strong>Gov UK Sign-in Journey ID</strong>: govuk_signin_journey_id</p>",
        },
        group_id: 1111111,
      },
    };
    await handler(createSnsEvent(testSuspiciousActivityEvent));
    expect(mockAxios.history.post.length).toBe(1);
    expect(mockAxios.history.post[0].data).toBe(JSON.stringify(expectedBody));
  });
});
