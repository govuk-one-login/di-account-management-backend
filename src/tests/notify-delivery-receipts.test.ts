import { vi, describe, test, expect, beforeEach, afterEach } from "vitest";
import { handler } from "../notify-delivery-receipts.js";
import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { APIGatewayProxyEvent, Context } from "aws-lambda";

vi.mock("@aws-lambda-powertools/parameters/secrets", () => ({
  getSecret: vi.fn(),
}));

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@aws-lambda-powertools/logger", () => ({
  Logger: class {
    info = mockLogger.info;
    error = mockLogger.error;
  },
}));

const mockMetrics = vi.hoisted(() => ({
  addDimension: vi.fn(),
  addMetric: vi.fn(),
  publishStoredMetrics: vi.fn(),
}));
const mockInitMetrics = vi.hoisted(() => vi.fn(() => mockMetrics));

vi.mock("../common/metrics.js", () => ({
  initMetrics: mockInitMetrics,
  metricsAPIGatewayProxyHandlerWrapper: vi.fn((_metrics, handler) => handler),
}));

const mockGetSecret = getSecret as ReturnType<typeof vi.fn>;

const validBody = JSON.stringify({
  id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  reference: "12345678",
  to: "hello@gov.uk",
  status: "delivered",
  created_at: "2017-05-14T12:15:30.000000Z",
  completed_at: "2017-05-14T12:15:30.000000Z",
  sent_at: "2017-05-14T12:15:30.000000Z",
  notification_type: "email",
  template_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  template_version: 1,
});

const makeEvent = (
  headers: Record<string, string>,
  body: string | null = null
): APIGatewayProxyEvent =>
  ({
    headers,
    body,
    multiValueHeaders: {},
    queryStringParameters: {},
    multiValueQueryStringParameters: {},
  }) as unknown as APIGatewayProxyEvent;

describe("handler", () => {
  beforeEach(() => {
    process.env.NOTIFY_DELIVERY_RECEIPTS_SECRET_ARN = "mock-secret-arn"; // pragma: allowlist secret
  });

  afterEach(() => {
    delete process.env.NOTIFY_DELIVERY_RECEIPTS_SECRET_ARN;
    vi.clearAllMocks();
  });

  test("returns 403 when authorization header is missing", async () => {
    const result = await handler(makeEvent({}), {} as Context);
    expect(result.statusCode).toBe(403);
  });

  test("returns 403 when bearer token does not match secret", async () => {
    mockGetSecret.mockResolvedValue("correct-token");
    const result = await handler(
      makeEvent({ Authorization: "Bearer wrong-token" }),
      {} as Context
    );
    expect(result.statusCode).toBe(403);
  });

  test("throws when NOTIFY_DELIVERY_RECEIPTS_SECRET_ARN is not set", async () => {
    delete process.env.NOTIFY_DELIVERY_RECEIPTS_SECRET_ARN;
    await expect(
      handler(makeEvent({ Authorization: "Bearer token" }), {} as Context)
    ).rejects.toThrow("NOTIFY_DELIVERY_RECEIPTS_SECRET_ARN not set");
  });

  test("returns 400 when body fails validation", async () => {
    mockGetSecret.mockResolvedValue("correct-token");
    const result = await handler(
      makeEvent(
        { Authorization: "Bearer correct-token" },
        JSON.stringify({ invalid: true })
      ),
      {} as Context
    );
    expect(result.statusCode).toBe(400);
  });

  test("returns 400 when body is null", async () => {
    mockGetSecret.mockResolvedValue("correct-token");
    const result = await handler(
      makeEvent({ Authorization: "Bearer correct-token" }, null),
      {} as Context
    );
    expect(result.statusCode).toBe(400);
  });

  test("returns 200, emits metric and logs receipt for valid body", async () => {
    mockGetSecret.mockResolvedValue("correct-token");
    const result = await handler(
      makeEvent({ Authorization: "Bearer correct-token" }, validBody),
      {} as Context
    );
    expect(result.statusCode).toBe(200);
    expect(mockMetrics.addDimension).toHaveBeenCalledWith(
      "status",
      "delivered"
    );
    expect(mockMetrics.addDimension).toHaveBeenCalledWith(
      "notification_type",
      "email"
    );
    expect(mockMetrics.addDimension).toHaveBeenCalledWith(
      "template_id",
      "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    );
    expect(mockMetrics.addMetric).toHaveBeenCalledWith(
      "NotifyDeliveryReceipt",
      "Count",
      1
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      "Received Notify delivery receipt",
      {
        id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        reference: "12345678",
        status: "delivered",
        notification_type: "email",
        template_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        created_at: "2017-05-14T12:15:30.000000Z",
        completed_at: "2017-05-14T12:15:30.000000Z",
        sent_at: "2017-05-14T12:15:30.000000Z",
      }
    );
  });

  test("returns 200 with nullable fields as null", async () => {
    mockGetSecret.mockResolvedValue("correct-token");
    const body = JSON.stringify({
      ...JSON.parse(validBody),
      reference: null,
      completed_at: null,
      sent_at: null,
    });
    const result = await handler(
      makeEvent({ Authorization: "Bearer correct-token" }, body),
      {} as Context
    );
    expect(result.statusCode).toBe(200);
    expect(mockLogger.info).toHaveBeenCalledWith(
      "Received Notify delivery receipt",
      {
        id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        reference: null,
        status: "delivered",
        notification_type: "email",
        template_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        created_at: "2017-05-14T12:15:30.000000Z",
        completed_at: null,
        sent_at: null,
      }
    );
  });
});
