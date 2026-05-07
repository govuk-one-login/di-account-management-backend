import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { SQSRecord, SQSBatchItemFailure, SQSEvent, Context } from "aws-lambda";

const mockGetSecret = vi.hoisted(() => vi.fn());
const mockNotifyClient = vi.hoisted(() => vi.fn());
const mockLogger = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  addContext: vi.fn(),
}));
const mockSendEmail = vi.fn();
const mockMetrics = vi.hoisted(() => ({
  addDimension: vi.fn(),
  addMetric: vi.fn(),
  publishStoredMetrics: vi.fn(),
}));
const mockInitMetrics = vi.hoisted(() => vi.fn(() => mockMetrics));

vi.mock("@aws-lambda-powertools/parameters/secrets", () => ({
  getSecret: mockGetSecret,
}));
vi.mock("notifications-node-client", () => ({
  NotifyClient: mockNotifyClient,
}));
vi.mock("@aws-lambda-powertools/logger", () => ({
  Logger: vi.fn(() => mockLogger),
}));
vi.mock("node:crypto", () => ({
  randomUUID: () => "test-uuid",
}));
vi.mock("ua-parser-js", () => ({
  default: () => ({
    browser: { name: "Chrome" },
    os: { name: "Mac OS" },
    device: { vendor: "Apple", model: "Macintosh" },
  }),
}));
vi.mock("../common/metrics", () => ({
  initMetrics: mockInitMetrics,
}));

describe("setUpNotifyClient", () => {
  let setUpNotifyClient: typeof import("../notification-service").setUpNotifyClient;
  let mockRecord: SQSRecord;
  let batchItemFailures: SQSBatchItemFailure[];
  const OLD_PROCESS_ENV = process.env;

  beforeEach(async () => {
    process.env = {
      ...OLD_PROCESS_ENV,
      NOTIFY_API_KEY: "NOTIFY_API_SECRET_KEY",
      NOTIFY_TEMPLATE_IDS: '{"GLOBAL_LOGOUT":"template-id"}',
    };
    setUpNotifyClient = (await import("../notification-service"))
      .setUpNotifyClient;
    mockRecord = { messageId: "test-message-id" } as SQSRecord;
    batchItemFailures = [];
  });

  afterEach(() => {
    process.env = OLD_PROCESS_ENV;
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("should create NotifyClient when secret is valid", async () => {
    const mockApiKey = "test-api-key";
    mockGetSecret.mockResolvedValue(mockApiKey);

    const result = await setUpNotifyClient(mockRecord, batchItemFailures);

    expect(mockGetSecret).toHaveBeenCalledWith("NOTIFY_API_SECRET_KEY", {
      maxAge: 900,
    });
    expect(mockNotifyClient).toHaveBeenCalledWith(mockApiKey);
    expect(result).toBe(mockNotifyClient.mock.instances[0]);
    expect(batchItemFailures).toHaveLength(0);
  });

  it("should add to batch failures when secret is undefined", async () => {
    mockGetSecret.mockResolvedValue(undefined);

    const result = await setUpNotifyClient(mockRecord, batchItemFailures);

    expect(mockLogger.error).toHaveBeenCalledWith("Secret is undefined", {
      messageId: "test-message-id",
      key: "NOTIFY_API_SECRET_KEY",
    });
    expect(mockMetrics.addDimension).toHaveBeenCalledWith(
      "failureReason",
      "Secret is undefined"
    );
    expect(mockMetrics.addMetric).toHaveBeenCalledWith(
      "notificationFailed",
      "Count",
      1
    );
    expect(result).toBeUndefined();
    expect(batchItemFailures).toEqual([{ itemIdentifier: "test-message-id" }]);
  });

  it("should add to batch failures when secret is not a string", async () => {
    mockGetSecret.mockResolvedValue(123);

    const result = await setUpNotifyClient(mockRecord, batchItemFailures);

    expect(mockLogger.error).toHaveBeenCalledWith("Secret is not a string", {
      messageId: "test-message-id",
      key: "NOTIFY_API_SECRET_KEY",
    });
    expect(mockMetrics.addDimension).toHaveBeenCalledWith(
      "failureReason",
      "Secret is not a string"
    );
    expect(mockMetrics.addMetric).toHaveBeenCalledWith(
      "notificationFailed",
      "Count",
      1
    );
    expect(result).toBeUndefined();
    expect(batchItemFailures).toEqual([{ itemIdentifier: "test-message-id" }]);
  });

  it("should return existing client on subsequent calls", async () => {
    const mockApiKey = "test-api-key";
    mockGetSecret.mockResolvedValue(mockApiKey);

    const firstResult = await setUpNotifyClient(mockRecord, batchItemFailures);
    const secondResult = await setUpNotifyClient(mockRecord, batchItemFailures);

    expect(mockGetSecret).toHaveBeenCalledTimes(1);
    expect(mockNotifyClient).toHaveBeenCalledTimes(1);
    expect(firstResult).toBe(secondResult);
  });
});

describe("processNotification", () => {
  let processNotification: typeof import("../notification-service").processNotification;
  let mockRecord: SQSRecord;
  let batchItemFailures: SQSBatchItemFailure[];
  const OLD_PROCESS_ENV = process.env;

  beforeEach(async () => {
    process.env = {
      ...OLD_PROCESS_ENV,
      NOTIFY_API_KEY: "NOTIFY_API_SECRET_KEY",
      NOTIFY_TEMPLATE_IDS: '{"GLOBAL_LOGOUT":"template-id"}',
    };

    // Set up the mock to return a client with sendEmail
    mockGetSecret.mockResolvedValue("test-api-key");
    mockNotifyClient.mockImplementation(() => ({ sendEmail: mockSendEmail }));

    const notificationService = await import("../notification-service");
    processNotification = notificationService.processNotification;

    mockRecord = {
      messageId: "test-message-id",
      body: JSON.stringify({
        notificationType: "GLOBAL_LOGOUT",
        emailAddress: "test@example.com",
        loggedOutAt: "2023-01-01T12:00:00Z",
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        countryCode: "GB",
      }),
    } as SQSRecord;
    batchItemFailures = [];

    mockSendEmail.mockResolvedValue({
      data: {
        id: "notification-id",
        reference: "test-reference",
      },
    });
  });

  afterEach(() => {
    process.env = OLD_PROCESS_ENV;
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("should return early when setUpNotifyClient returns undefined (secret undefined)", async () => {
    mockGetSecret.mockResolvedValue(undefined);

    await processNotification(mockRecord, batchItemFailures);

    expect(mockLogger.error).toHaveBeenCalledWith("Secret is undefined", {
      messageId: "test-message-id",
      key: "NOTIFY_API_SECRET_KEY",
    });
    expect(batchItemFailures).toEqual([{ itemIdentifier: "test-message-id" }]);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("should handle invalid JSON and log error", async () => {
    mockRecord.body = "invalid json";

    await processNotification(mockRecord, batchItemFailures);

    expect(mockLogger.error).toHaveBeenCalledWith("Message is not valid JSON", {
      messageId: "test-message-id",
    });
    expect(mockMetrics.addDimension).toHaveBeenCalledWith(
      "failureReason",
      "Message is not valid JSON"
    );
    expect(mockMetrics.addMetric).toHaveBeenCalledWith(
      "notificationFailed",
      "Count",
      1
    );
    expect(mockLogger.info).not.toHaveBeenCalled();
    expect(batchItemFailures).toEqual([{ itemIdentifier: "test-message-id" }]);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("should handle invalid message format and log error", async () => {
    mockRecord.body = JSON.stringify({ invalid: "message" });

    await processNotification(mockRecord, batchItemFailures);

    expect(mockLogger.error).toHaveBeenCalledWith("Invalid message format", {
      messageId: "test-message-id",
    });
    expect(mockMetrics.addDimension).toHaveBeenCalledWith(
      "failureReason",
      "Invalid message format"
    );
    expect(mockMetrics.addMetric).toHaveBeenCalledWith(
      "notificationFailed",
      "Count",
      1
    );
    expect(mockLogger.info).not.toHaveBeenCalled();
    expect(batchItemFailures).toEqual([{ itemIdentifier: "test-message-id" }]);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("should handle Axios error and log error", async () => {
    const axiosError = {
      isAxiosError: true,
      response: {
        status: 400,
        statusText: "Bad Request",
        data: "Error details",
      },
    };
    mockSendEmail.mockRejectedValue(axiosError);

    await processNotification(mockRecord, batchItemFailures);

    expect(mockLogger.error).toHaveBeenCalledWith(
      "Unable to send notification",
      {
        messageId: "test-message-id",
        notificationType: "GLOBAL_LOGOUT",
        status: 400,
        statusText: "Bad Request",
        details: "Error details",
      }
    );
    expect(mockMetrics.addDimension).toHaveBeenCalledWith(
      "failureReason",
      "Unable to send notification"
    );
    expect(mockMetrics.addMetric).toHaveBeenCalledWith(
      "notificationFailed",
      "Count",
      1
    );
    expect(batchItemFailures).toEqual([{ itemIdentifier: "test-message-id" }]);
  });

  it("should handle unknown error and log error", async () => {
    const unknownError = new Error("Unknown error");
    mockSendEmail.mockRejectedValue(unknownError);

    await processNotification(mockRecord, batchItemFailures);

    expect(mockLogger.error).toHaveBeenCalledWith(
      "Unable to send notification due to an unknown error",
      {
        messageId: "test-message-id",
        notificationType: "GLOBAL_LOGOUT",
        details: "Unknown error",
      }
    );
    expect(mockMetrics.addDimension).toHaveBeenCalledWith(
      "failureReason",
      "Unable to send notification due to an unknown error"
    );
    expect(mockMetrics.addMetric).toHaveBeenCalledWith(
      "notificationFailed",
      "Count",
      1
    );
    expect(batchItemFailures).toEqual([{ itemIdentifier: "test-message-id" }]);
  });

  it("should handle invalid result format and log error", async () => {
    mockSendEmail.mockResolvedValue({ invalid: "result" });

    await processNotification(mockRecord, batchItemFailures);

    expect(mockLogger.error).toHaveBeenCalledWith("Invalid result format", {
      messageId: "test-message-id",
      notificationType: "GLOBAL_LOGOUT",
    });
    expect(mockMetrics.addDimension).toHaveBeenCalledWith(
      "failureReason",
      "Invalid result format"
    );
    expect(mockMetrics.addMetric).toHaveBeenCalledWith(
      "notificationFailed",
      "Count",
      1
    );
    expect(batchItemFailures).toEqual([{ itemIdentifier: "test-message-id" }]);
  });

  it("should successfully process notification and log success", async () => {
    await processNotification(mockRecord, batchItemFailures);

    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(
      "Successfully sent a notification",
      {
        messageId: "test-message-id",
        id: "notification-id",
        reference: "test-reference",
        notificationType: "GLOBAL_LOGOUT",
      }
    );
    expect(mockMetrics.addMetric).toHaveBeenCalledWith(
      "notificationSent",
      "Count",
      1
    );
    expect(batchItemFailures).toEqual([]);
  });
});

describe("handler", () => {
  const OLD_PROCESS_ENV = process.env;

  beforeEach(async () => {
    process.env = {
      ...OLD_PROCESS_ENV,
      NOTIFY_API_KEY: "NOTIFY_API_SECRET_KEY",
      NOTIFY_TEMPLATE_IDS: '{"GLOBAL_LOGOUT":"template-id"}',
    };

    mockGetSecret.mockResolvedValue("test-api-key");
    mockNotifyClient.mockImplementation(() => ({ sendEmail: mockSendEmail }));
  });

  afterEach(() => {
    process.env = OLD_PROCESS_ENV;
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("should add context to logger and process all records", async () => {
    const { handler } = await import("../notification-service");
    mockSendEmail.mockResolvedValue({
      data: { id: "notification-id", reference: "test-ref" },
    });

    const mockContext = { requestId: "test-request-id" } as unknown as Context;
    const mockEvent = {
      Records: [
        {
          messageId: "msg-1",
          body: JSON.stringify({
            notificationType: "GLOBAL_LOGOUT",
            emailAddress: "test@example.com",
            loggedOutAt: "2023-01-01T12:00:00Z",
            ipAddress: "192.168.1.1",
            userAgent: "Mozilla/5.0",
            countryCode: "GB",
          }),
        },
        {
          messageId: "msg-2",
          body: JSON.stringify({
            notificationType: "GLOBAL_LOGOUT",
            emailAddress: "test2@example.com",
            loggedOutAt: "2023-01-01T12:00:00Z",
            ipAddress: "192.168.1.2",
            userAgent: "Mozilla/5.0",
            countryCode: "GB",
          }),
        },
      ],
    } as SQSEvent;

    const result = await handler(mockEvent, mockContext);

    expect(mockInitMetrics).toHaveBeenCalledWith("notification-service");
    expect(mockLogger.addContext).toHaveBeenCalledWith(mockContext);
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
    expect(mockMetrics.publishStoredMetrics).toHaveBeenCalled();
    expect(result).toEqual({ batchItemFailures: [] });
  });

  it("should return batch item failures from processNotification", async () => {
    const { handler } = await import("../notification-service");
    mockGetSecret.mockResolvedValue(undefined);

    const mockContext = { requestId: "test-request-id" } as unknown as Context;
    const mockEvent = {
      Records: [
        {
          messageId: "msg-1",
          body: JSON.stringify({
            notificationType: "GLOBAL_LOGOUT",
            emailAddress: "test@example.com",
            loggedOutAt: "2023-01-01T12:00:00Z",
            ipAddress: "192.168.1.1",
            userAgent: "Mozilla/5.0",
            countryCode: "GB",
          }),
        },
      ],
    } as SQSEvent;

    const result = await handler(mockEvent, mockContext);

    expect(mockInitMetrics).toHaveBeenCalledWith("notification-service");
    expect(mockMetrics.publishStoredMetrics).toHaveBeenCalled();
    expect(result).toEqual({
      batchItemFailures: [{ itemIdentifier: "msg-1" }],
    });
  });
});
