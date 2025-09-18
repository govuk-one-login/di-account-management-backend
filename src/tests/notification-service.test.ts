import { SQSEvent, Context, SQSRecord } from "aws-lambda";
import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { NotifyClient } from "notifications-node-client";
import UAParser from "ua-parser-js";

const mockLoggerInstance = {
  addContext: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
};

jest.mock("@aws-lambda-powertools/parameters/secrets");
jest.mock("notifications-node-client");
jest.mock("ua-parser-js");
jest.mock("@aws-lambda-powertools/logger", () => ({
  Logger: jest.fn().mockImplementation(() => mockLoggerInstance),
}));

import { handler } from "../notification-service";

const mockGetSecret = getSecret as jest.MockedFunction<typeof getSecret>;
const mockNotifyClient = NotifyClient as jest.MockedClass<typeof NotifyClient>;
const mockUAParser = UAParser as jest.MockedFunction<typeof UAParser>;

describe("notification-service handler", () => {
  const OLD_PROCESS_ENV = process.env;
  const mockContext: Partial<Context> = {};

  const validGlobalLogoutMessages = [
    {
      notificationType: "GLOBAL_LOGOUT",
      emailAddress: "test1@example.com",
      loggedOutAt: "2023-01-01T12:00:00.000Z",
      ipAddress: "192.168.1.1",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      countryCode: "GB",
    },
    {
      notificationType: "GLOBAL_LOGOUT",
      emailAddress: "test2@example.com",
      loggedOutAt: "2023-01-01T13:00:00.000Z",
      ipAddress: "192.168.1.2",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      countryCode: "US",
    },
    {
      notificationType: "GLOBAL_LOGOUT",
      emailAddress: "test3@example.com",
      loggedOutAt: "2023-01-01T14:00:00.000Z",
      ipAddress: "192.168.1.3",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      countryCode: "FR",
    },
  ];

  const createSQSEvent = (messages: Record<string, string>[]): SQSEvent => ({
    Records: messages.map((message, index) => ({
      messageId: `msg-${index}`,
      body: JSON.stringify(message),
    })) as SQSRecord[],
  });

  beforeEach(() => {
    process.env = {
      ...OLD_PROCESS_ENV,
      NOTIFY_TEMPLATE_IDS: JSON.stringify({
        GLOBAL_LOGOUT: "template-123",
      }),
      NOTIFY_API_KEY: "NOTIFY_API_KEY_SECRET",
    };

    mockUAParser.mockReturnValue({
      browser: { name: "Chrome" },
      os: { name: "Windows" },
      device: { vendor: "Apple", model: "iPhone" },
    } as UAParser.IResult);
  });

  afterEach(() => {
    jest.clearAllMocks();
    process.env = OLD_PROCESS_ENV;
  });

  it("should fail when notifyTemplateIds cannot be parsed", async () => {
    process.env.NOTIFY_TEMPLATE_IDS = "invalid-json";
    const event = createSQSEvent(validGlobalLogoutMessages);

    const result = await handler(event, mockContext as Context);

    expect(result.batchItemFailures).toHaveLength(3);
    expect(result.batchItemFailures[0].itemIdentifier).toBe("msg-0");
    expect(result.batchItemFailures[1].itemIdentifier).toBe("msg-1");
    expect(result.batchItemFailures[2].itemIdentifier).toBe("msg-2");
    expect(mockLoggerInstance.error).toHaveBeenCalledWith(
      "Error occurred when sending notifications",
      { error: expect.anything() }
    );
  });

  it("should fail when notify API key is undefined", async () => {
    mockGetSecret.mockResolvedValue(undefined);
    const event = createSQSEvent(validGlobalLogoutMessages);

    const result = await handler(event, mockContext as Context);

    expect(result.batchItemFailures).toHaveLength(3);
    expect(result.batchItemFailures[0].itemIdentifier).toBe("msg-0");
    expect(result.batchItemFailures[1].itemIdentifier).toBe("msg-1");
    expect(result.batchItemFailures[2].itemIdentifier).toBe("msg-2");
    expect(mockLoggerInstance.error).toHaveBeenCalledWith(
      "Error occurred when sending notifications",
      { error: expect.anything() }
    );
  });

  it("should handle mixed success and failure scenarios", async () => {
    mockGetSecret.mockResolvedValue("api-key-123");

    const mockSendEmail = jest.fn();
    mockNotifyClient.mockImplementation(
      () =>
        ({
          sendEmail: mockSendEmail,
        }) as unknown as InstanceType<typeof NotifyClient>
    );

    const invalidMessage = { invalid: "message" };

    mockSendEmail
      .mockResolvedValueOnce({
        response: {
          data: {
            id: "notification-1",
            reference: "ref-1",
            content: {
              subject: "Test Subject",
              body: "Test Body",
              from_email: "noreply@example.com",
            },
            uri: "https://api.notifications.service.gov.uk/v2/notifications/notification-1",
            template: {
              id: "template-123",
              version: 1,
              uri: "https://api.notifications.service.gov.uk/v2/templates/template-123",
            },
          },
        },
      })
      .mockRejectedValueOnce(new Error("Send email failed"))
      .mockResolvedValueOnce({
        response: {
          data: {
            id: "notification-3",
            reference: "ref-3",
            content: {
              subject: "Test Subject",
              body: "Test Body",
              from_email: "noreply@example.com",
            },
            uri: "https://api.notifications.service.gov.uk/v2/notifications/notification-3",
            template: {
              id: "template-123",
              version: 1,
              uri: "https://api.notifications.service.gov.uk/v2/templates/template-123",
            },
          },
        },
      });

    const event = createSQSEvent([
      ...validGlobalLogoutMessages,
      invalidMessage,
    ]);

    const result = await handler(event, mockContext as Context);

    expect(result.batchItemFailures).toHaveLength(2);
    expect(result.batchItemFailures.map((f) => f.itemIdentifier)).toEqual([
      "msg-3",
      "msg-1",
    ]);
    expect(mockSendEmail).toHaveBeenCalledTimes(3);

    expect(mockLoggerInstance.info).toHaveBeenCalledWith(
      "Successfully sent a notification",
      {
        messageId: "msg-0",
        id: "notification-1",
        reference: "ref-1",
      }
    );

    expect(mockLoggerInstance.error).toHaveBeenCalledWith(
      "Error occurred when sending a notification",
      {
        messageId: "msg-1",
        error: expect.anything(),
      }
    );

    expect(mockLoggerInstance.info).toHaveBeenCalledWith(
      "Successfully sent a notification",
      {
        messageId: "msg-2",
        id: "notification-3",
        reference: "ref-3",
      }
    );

    expect(mockLoggerInstance.error).toHaveBeenCalledWith(
      "Error occurred when sending a notification",
      {
        messageId: "msg-3",
        error: expect.anything(),
      }
    );

    expect(mockSendEmail).toHaveBeenNthCalledWith(
      1,
      "template-123",
      "test1@example.com",
      {
        personalisation: expect.objectContaining({
          ipAddress: "192.168.1.1",
          countryName_en: "United Kingdom",
          countryName_cy: "Y Deyrnas Unedig",
          loggedOutAt_en: "Sunday, 1 January 2023 at 12:00",
          loggedOutAt_cy: "Dydd Sul, 1 Ionawr 2023 am 12:00",
          browser: "Chrome",
          os: "Windows",
          deviceVendor: "Apple",
          deviceModel: "iPhone",
        }),
        reference: expect.any(String),
      }
    );

    expect(mockSendEmail).toHaveBeenNthCalledWith(
      3,
      "template-123",
      "test3@example.com",
      {
        personalisation: expect.objectContaining({
          ipAddress: "192.168.1.3",
          countryName_en: "France",
          countryName_cy: "Ffrainc",
          loggedOutAt_en: "Sunday, 1 January 2023 at 14:00",
          loggedOutAt_cy: "Dydd Sul, 1 Ionawr 2023 am 14:00",
          browser: "Chrome",
          os: "Windows",
          deviceVendor: "Apple",
          deviceModel: "iPhone",
        }),
        reference: expect.any(String),
      }
    );
  });
});
