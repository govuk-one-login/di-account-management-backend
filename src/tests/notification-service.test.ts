import { handler } from "../notification-service";
import { SQSEvent, Context, SQSRecord } from "aws-lambda";
import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { NotifyClient } from "notifications-node-client";

jest.mock("@aws-lambda-powertools/parameters/secrets");
jest.mock("notifications-node-client");

const mockGetSecret = getSecret as jest.MockedFunction<typeof getSecret>;
const mockNotifyClient = NotifyClient as jest.MockedClass<typeof NotifyClient>;

describe("notification-service handler", () => {
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
    process.env.NOTIFY_TEMPLATE_IDS = JSON.stringify({
      GLOBAL_LOGOUT: "template-123",
    });
    process.env.NOTIFY_API_KEY = "NOTIFY_API_KEY_SECRET";
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should fail when notifyTemplateIds cannot be parsed", async () => {
    process.env.NOTIFY_TEMPLATE_IDS = "invalid-json";
    const event = createSQSEvent(validGlobalLogoutMessages);

    const result = await handler(event, mockContext as Context);

    expect(result.batchItemFailures).toHaveLength(3);
    expect(result.batchItemFailures[0].itemIdentifier).toBe("msg-0");
    expect(result.batchItemFailures[1].itemIdentifier).toBe("msg-1");
    expect(result.batchItemFailures[2].itemIdentifier).toBe("msg-2");
  });

  it("should fail when notify API key is undefined", async () => {
    mockGetSecret.mockResolvedValue(undefined);
    const event = createSQSEvent(validGlobalLogoutMessages);

    const result = await handler(event, mockContext as Context);

    expect(result.batchItemFailures).toHaveLength(3);
    expect(result.batchItemFailures[0].itemIdentifier).toBe("msg-0");
    expect(result.batchItemFailures[1].itemIdentifier).toBe("msg-1");
    expect(result.batchItemFailures[2].itemIdentifier).toBe("msg-2");
  });

  it("should handle mixed success and failure scenarios", async () => {
    mockGetSecret.mockResolvedValue("api-key-123");

    const mockSendEmail = jest.fn();
    mockNotifyClient.mockImplementation(
      () =>
        ({
          sendEmail: mockSendEmail,
        }) as any
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
  });
});
