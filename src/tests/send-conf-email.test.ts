import { formatActivityObjectForEmail, sendConfMail } from "../send-conf-email";
import { NotifyClient } from "notifications-node-client";
import { ReportSuspiciousActivityEvent } from "../common/model";

jest.mock("notifications-node-client");
jest.mock("@aws-lambda-powertools/parameters/secrets");

describe("formatActivityObjectForEmail", () => {
  afterEach(() => {
    process.env.ENVIRONMENT_NAME = undefined;
  });

  test("should return formatted activity object for email", () => {
    process.env.ENVIRONMENT_NAME = "local";

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

    const result = formatActivityObjectForEmail(input);

    expect(result).toEqual({
      email: "test@example.com",
      personalisation: {
        clientNameEn: "GOV.UK email subscriptions",
        clientNameCy: "Tanysgrifiadau e-byst GOV.UK",
        dateCy: "15 Mawrth 2024 am 11:08",
        dateEn: "15 March 2024 at 11:08",
        ticketId: "123",
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
          dateCy: "15 Mawrth 2024 am 11:08",
          dateEn: "15 March 2024 at 11:08",
          ticketId: "123",
        },
        reference: "123",
      }
    );
  });
});
