import {
  handler,
  formatActivityObjectForEmail,
  sendConfMail,
} from "../send-conf-email";
import { NotifyClient } from "notifications-node-client";
import { ReportSuspiciousActivityEvent } from "../common/model";
import { HOME_CLIENT_ID_TEST } from "../common/constants";
import { getSecret } from "@aws-lambda-powertools/parameters/secrets";

jest.mock("notifications-node-client");
jest.mock("@aws-lambda-powertools/parameters/secrets", () => ({
  getSecret: jest.fn(),
}));
describe("formatActivityObjectForEmail", () => {
  afterEach(() => {
    process.env.ENVIRONMENT_NAME = undefined;
  });

  const getInput = () => {
    return {
      event_id: "522c5ab4-7e66-4b2a-8f5c-4d31dc4e93e6",
      event_type: "HOME_REPORT_SUSPICIOUS_ACTIVITY",
      persistent_session_id: "persistent_session_id",
      session_id: "session_id",
      email_address: "test@example.com",
      component_id: "https://home.account.gov.uk",
      timestamp: 1708971886,
      event_timestamp_ms: 1708971886515,
      event_timestamp_ms_formatted: "2024-02-26T18:24:46.515Z",
      suspicious_activity: {
        event_type: "Suspicious Activity",
        session_id: "123456789",
        user_id: "abc",
        timestamp: 1710500905,
        client_id: "gov-uk",
        event_id: "123",
        reported_suspicious: true,
      },
      zendesk_ticket_id: "123",
    };
  };

  test("should return formatted activity object for email", () => {
    process.env.ENVIRONMENT_NAME = "local";

    const result = formatActivityObjectForEmail(getInput());

    expect(result).toEqual({
      email: "test@example.com",
      personalisation: {
        clientNameEn: "GOV.UK email subscriptions",
        clientNameCy: "Tanysgrifiadau e-byst GOV.UK",
        dateCy: "15 Mawrth 2024 am 11:08 yb",
        dateEn: "15 March 2024 at 11:08 am",
        ticketId: "123",
        showHomeHintText: false,
      },
    });
  });

  test("should include description for One Login Home events", () => {
    process.env.ENVIRONMENT_NAME = "local";

    const input = getInput();
    input.suspicious_activity.client_id = HOME_CLIENT_ID_TEST;

    const result = formatActivityObjectForEmail(input);

    expect(result).toEqual({
      email: "test@example.com",
      personalisation: {
        clientNameEn: "Your GOV.UK One Login",
        clientNameCy: "Eich GOV.UK One Login",
        dateCy: "15 Mawrth 2024 am 11:08 yb",
        dateEn: "15 March 2024 at 11:08 am",
        ticketId: "123",
        showHomeHintText: true,
      },
    });
  });
});

describe("sendConfMail", () => {
  test("should send confirmation email", async () => {
    process.env.ENVIRONMENT_NAME = "local";
    const apiKey = "API_KEY";
    const templateId = "TEMPLATE_ID";

    const notifyClientMock = {
      sendEmail: jest.fn().mockResolvedValueOnce({}),
    };

    jest
      .spyOn(NotifyClient.prototype, "sendEmail")
      .mockImplementationOnce(notifyClientMock.sendEmail);

    const input: ReportSuspiciousActivityEvent = {
      event_id: "522c5ab4-7e66-4b2a-8f5c-4d31dc4e93e6",
      event_type: "HOME_REPORT_SUSPICIOUS_ACTIVITY",
      persistent_session_id: "persistent_session_id",
      session_id: "session_id",
      email_address: "test@example.com",
      component_id: "https://home.account.gov.uk",
      timestamp: 1708971886,
      event_timestamp_ms: 1708971886515,
      event_timestamp_ms_formatted: "2024-02-26T18:24:46.515Z",
      suspicious_activity: {
        event_type: "Suspicious Activity",
        session_id: "123456789",
        user_id: "abc",
        timestamp: 1710500905,
        client_id: "gov-uk",
        event_id: "123",
        reported_suspicious: true,
      },
      zendesk_ticket_id: "123",
    };

    await sendConfMail(apiKey, templateId, input);

    expect(notifyClientMock.sendEmail).toHaveBeenCalledWith(
      templateId,
      "test@example.com",
      {
        personalisation: {
          clientNameEn: "GOV.UK email subscriptions",
          clientNameCy: "Tanysgrifiadau e-byst GOV.UK",
          dateCy: "15 Mawrth 2024 am 11:08 yb",
          dateEn: "15 March 2024 at 11:08 am",
          ticketId: "123",
          showHomeHintText: false,
        },
        reference: "123",
      },
    );
  });
});
describe("handler", () => {
  const mockGetSecret = getSecret as jest.MockedFunction<typeof getSecret>;
  const input: ReportSuspiciousActivityEvent = {
    event_id: "522c5ab4-7e66-4b2a-8f5c-4d31dc4e93e6",
    event_type: "HOME_REPORT_SUSPICIOUS_ACTIVITY",
    persistent_session_id: "persistent_session_id",
    session_id: "session_id",
    email_address: "test@example.com",
    component_id: "https://home.account.gov.uk",
    timestamp: 1708971886,
    event_timestamp_ms: 1708971886515,
    event_timestamp_ms_formatted: "2024-02-26T18:24:46.515Z",
    suspicious_activity: {
      event_type: "Suspicious Activity",
      session_id: "123456789",
      user_id: "abc",
      timestamp: 1710500905,
      client_id: "gov-uk",
      event_id: "123",
      reported_suspicious: true,
    },
    zendesk_ticket_id: "123",
  };
  beforeEach(() => {
    process.env.ENVIRONMENT_NAME = "local";
    process.env.NOTIFY_API_KEY = "mock-api-key";
    process.env.TEMPLATE_ID = "mock-template-id";
    mockGetSecret.mockResolvedValue("your-mock-value");
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should handle notify errors from sendConfMail correctly", async () => {
    const errorResponse = {
      response: {
        data: {
          status_code: 400,
          errors: [
            {
              error: "BadRequestError",
              message: "Can't send to this recipient using a team-only API key",
            },
          ],
        },
      },
    };
    const notifyClientMock = {
      sendEmail: jest.fn().mockRejectedValueOnce(errorResponse),
    };

    jest
      .spyOn(NotifyClient.prototype, "sendEmail")
      .mockImplementationOnce(notifyClientMock.sendEmail);

    await expect(handler(input)).rejects.toThrow(
      'Error sending email for event: [{"error":"BadRequestError","message":"Can\'t send to this recipient using a team-only API key"}]',
    );
  });

  test("should handle errors from sendConfMail correctly", async () => {
    const errorResponse = {
      response: {
        data: {
          status_code: 502,
          errors: [
            {
              error: "BadRequest",
              message: "Invalid status code",
            },
          ],
        },
      },
    };
    const notifyClientMock = {
      sendEmail: jest.fn().mockRejectedValueOnce(errorResponse),
    };

    jest
      .spyOn(NotifyClient.prototype, "sendEmail")
      .mockImplementationOnce(notifyClientMock.sendEmail);

    await expect(handler(input)).rejects.toThrow(
      'Error sending email for event: {"response":{}}',
    );
  });

  test("should handle errors from sendConfMail correctly with invalid status code", async () => {
    const errorResponse = {
      response: {
        data: {
          status_code: 502,
          errors: [
            {
              error: "BadRequest",
              message: "Something else",
            },
          ],
        },
      },
    };
    const notifyClientMock = {
      sendEmail: jest.fn().mockRejectedValueOnce(errorResponse),
    };

    jest
      .spyOn(NotifyClient.prototype, "sendEmail")
      .mockImplementationOnce(notifyClientMock.sendEmail);

    await expect(handler(input)).rejects.toThrow(
      'Error sending email for event: {"response":{}}',
    );
  });

  test("should handle errors with invalid status codes and data", async () => {
    const errorResponse = {
      response: {
        data: {
          bearerToken: "Bearer 123123123",
          status_code: 502,
          errors: [
            {
              error: "BadRequest",
              message: "Invalid request parameters",
            },
          ],
        },
        "non-important-data": "hello dev",
      },
    };
    jest
      .spyOn(NotifyClient.prototype, "sendEmail")
      .mockRejectedValueOnce(errorResponse);

    await expect(handler(input)).rejects.toThrow(
      'Error sending email for event: {"response":{"non-important-data":"hello dev"}}',
    );
  });

  test("should handle errors with err.response but without expected data correctly", async () => {
    const errorResponse = {
      response: {
        // Simulating a response without the expected 'data' structure
        status: "404",
        statusText: "Not Found",
      },
    };
    jest
      .spyOn(NotifyClient.prototype, "sendEmail")
      .mockRejectedValueOnce(errorResponse);

    await expect(handler(input)).rejects.toThrow(
      "Error sending email for event",
    );
  });
});
