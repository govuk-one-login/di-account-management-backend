import { SuspiciousActivityEvent } from "../common/model";
import { formatActivityObjectForEmail, sendConfMail } from "../send-conf-email";
import { NotifyClient } from "notifications-node-client";

jest.mock("notifications-node-client");
jest.mock("@aws-lambda-powertools/parameters/secrets");
jest.mock("../common/sqs");

describe("formatActivityObjectForEmail", () => {
  afterEach(() => {
    process.env.ENVIRONMENT_NAME = undefined;
  });

  test("should return formatted activity object for email", () => {
    process.env.ENVIRONMENT_NAME = "local";
    const activity: SuspiciousActivityEvent = {
      event_id: "123",
      event_name: "Suspicious Activity",
      timestamp: 23423423423,
      timestamp_formatted: "2022-01-01 00:00:00",
      reported_suspicious: true,
      user: {
        email: "test@example.com",
        user_id: "abc",
      },
      client_id: "gov-uk",
    };

    const result = formatActivityObjectForEmail(activity);

    expect(result).toEqual({
      email: "test@example.com",
      clientNameEn: "GOV.UK email subscriptions",
      clientNameCy: "Tanysgrifiadau e-byst GOV.UK",
    });
  });

  test("should throw an error if email address is not present in the activity", () => {
    const activity: SuspiciousActivityEvent = {
      event_id: "123",
      event_name: "Suspicious Activity",
      timestamp: 23423423423,
      timestamp_formatted: "2022-01-01 00:00:00",
      reported_suspicious: true,
      user: {
        user_id: "abc",
      },
      client_id: "gov-uk",
    };

    process.env.ENVIRONMENT_NAME = "local";

    expect(() => {
      formatActivityObjectForEmail(activity);
    }).toThrow("Email address not present in Suspicious Activity Event");
  });
});

describe("sendConfMail", () => {
  test("should send confirmation email", async () => {
    process.env.ENVIRONMENT_NAME = "local";
    const apiKey = "API_KEY";
    const templateId = "TEMPLATE_ID";
    const activity: SuspiciousActivityEvent = {
      event_id: "123",
      event_name: "Suspicious Activity",
      timestamp: 23423423423,
      timestamp_formatted: "2022-01-01 00:00:00",
      reported_suspicious: true,
      user: {
        email: "test@example.com",
        user_id: "abc",
      },
      client_id: "gov-uk",
    };

    const notifyClientMock = {
      sendEmail: jest.fn().mockResolvedValueOnce({}),
    };

    jest
      .spyOn(NotifyClient.prototype, "sendEmail")
      .mockImplementationOnce(notifyClientMock.sendEmail);

    await sendConfMail(apiKey, templateId, activity);

    expect(notifyClientMock.sendEmail).toHaveBeenCalledWith(
      templateId,
      "test@example.com",
      {
        personalisation: {
          clientNameEn: "GOV.UK email subscriptions",
          clientNameCy: "Tanysgrifiadau e-byst GOV.UK",
        },
        reference: "123",
      }
    );
  });
});
