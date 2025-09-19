import { SQSRecord, SQSBatchItemFailure } from "aws-lambda";

const mockGetSecret = jest.fn();
const mockNotifyClient = jest.fn();
const mockSetUpNotifyClient = jest.fn();
const mockLogger = {
  error: jest.fn(),
  info: jest.fn(),
};
const mockSendEmail = jest.fn();

jest.mock("@aws-lambda-powertools/parameters/secrets", () => ({
  getSecret: mockGetSecret,
}));
jest.mock("notifications-node-client", () => ({
  NotifyClient: mockNotifyClient,
}));
jest.mock("@aws-lambda-powertools/logger", () => ({
  Logger: jest.fn(() => mockLogger),
}));
jest.mock("node:crypto", () => ({
  randomUUID: () => "test-uuid",
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
    jest.clearAllMocks();
    jest.resetModules();
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
  // TODO get sig from file rather than duplicating
  let processNotification: (
    record: SQSRecord,
    batchItemFailures: SQSBatchItemFailure[]
  ) => Promise<void>;
  let mockRecord: SQSRecord;
  let batchItemFailures: SQSBatchItemFailure[];
  const OLD_PROCESS_ENV = process.env;

  beforeEach(async () => {
    process.env = {
      ...OLD_PROCESS_ENV,
      NOTIFY_TEMPLATE_IDS: '{"GLOBAL_LOGOUT":"template-id"}',
    };

    const notificationService = await import("../notification-service");
    processNotification = notificationService.processNotification;
    jest
      .spyOn(notificationService, "setUpNotifyClient")
      .mockImplementation(mockSetUpNotifyClient);

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
    jest.clearAllMocks();
    jest.resetModules();
  });

  it("should return early when setUpNotifyClient returns undefined", async () => {
    mockSetUpNotifyClient.mockResolvedValue(undefined);

    await processNotification(mockRecord, batchItemFailures);

    expect(mockSetUpNotifyClient).toHaveBeenCalledWith(
      mockRecord,
      batchItemFailures
    );
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.info).not.toHaveBeenCalled();
    expect(batchItemFailures).toEqual([]);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("should handle invalid JSON and log error", async () => {
    mockSetUpNotifyClient.mockResolvedValue({ sendEmail: mockSendEmail });
    mockRecord.body = "invalid json";

    await processNotification(mockRecord, batchItemFailures);

    expect(mockLogger.error).toHaveBeenCalledWith("Message is not valid JSON", {
      messageId: "test-message-id",
    });
    expect(mockLogger.info).not.toHaveBeenCalled();
    expect(batchItemFailures).toEqual([{ itemIdentifier: "test-message-id" }]);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("should handle invalid message format and log error", async () => {
    mockSetUpNotifyClient.mockResolvedValue({ sendEmail: mockSendEmail });
    mockRecord.body = JSON.stringify({ invalid: "message" });

    await processNotification(mockRecord, batchItemFailures);

    expect(mockLogger.error).toHaveBeenCalledWith("Invalid message format", {
      messageId: "test-message-id",
    });
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
    mockSetUpNotifyClient.mockResolvedValue({ sendEmail: mockSendEmail });
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
    expect(mockLogger.info).not.toHaveBeenCalled();
    expect(batchItemFailures).toEqual([{ itemIdentifier: "test-message-id" }]);
    expect(mockSendEmail).toHaveBeenCalledWith(
      "template-id",
      "test@example.com",
      expect.objectContaining({
        personalisation: expect.any(Object),
        reference: "test-uuid",
      })
    );
  });

  it("should handle unknown error and log error", async () => {
    const unknownError = new Error("Unknown error");
    mockSetUpNotifyClient.mockResolvedValue({ sendEmail: mockSendEmail });
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
    expect(mockLogger.info).not.toHaveBeenCalled();
    expect(batchItemFailures).toEqual([{ itemIdentifier: "test-message-id" }]);
    expect(mockSendEmail).toHaveBeenCalledWith(
      "template-id",
      "test@example.com",
      expect.objectContaining({
        personalisation: expect.any(Object),
        reference: "test-uuid",
      })
    );
  });

  it("should handle invalid result format and log error", async () => {
    mockSetUpNotifyClient.mockResolvedValue({ sendEmail: mockSendEmail });
    mockSendEmail.mockResolvedValue({ invalid: "result" });

    await processNotification(mockRecord, batchItemFailures);

    expect(mockLogger.error).toHaveBeenCalledWith("Invalid result format", {
      messageId: "test-message-id",
      notificationType: "GLOBAL_LOGOUT",
    });
    expect(mockLogger.info).not.toHaveBeenCalled();
    expect(batchItemFailures).toEqual([{ itemIdentifier: "test-message-id" }]);
    expect(mockSendEmail).toHaveBeenCalledWith(
      "template-id",
      "test@example.com",
      expect.objectContaining({
        personalisation: expect.any(Object),
        reference: "test-uuid",
      })
    );
  });

  it("should successfully process notification and log success", async () => {
    mockSetUpNotifyClient.mockResolvedValue({ sendEmail: mockSendEmail });

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
    expect(batchItemFailures).toEqual([]);
    expect(mockSendEmail).toHaveBeenCalledWith(
      "template-id",
      "test@example.com",
      expect.objectContaining({
        personalisation: expect.any(Object),
        reference: "test-uuid",
      })
    );
  });
});
