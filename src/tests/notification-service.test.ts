import { SQSRecord, SQSBatchItemFailure } from "aws-lambda";

const mockGetSecret = jest.fn();
const mockNotifyClient = jest.fn();
const mockLogger = {
  error: jest.fn(),
};

jest.mock("@aws-lambda-powertools/parameters/secrets", () => ({
  getSecret: mockGetSecret,
}));
jest.mock("notifications-node-client", () => ({
  NotifyClient: mockNotifyClient,
}));
jest.mock("@aws-lambda-powertools/logger", () => ({
  Logger: jest.fn(() => mockLogger),
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
