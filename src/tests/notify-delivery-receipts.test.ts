import { vi, describe, test, expect, beforeEach, afterEach } from "vitest";
import { handler } from "../notify-delivery-receipts.js";
import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { APIGatewayProxyEvent, Context } from "aws-lambda";

vi.mock("@aws-lambda-powertools/parameters/secrets", () => ({
  getSecret: vi.fn(),
}));

const mockGetSecret = getSecret as ReturnType<typeof vi.fn>;

const makeEvent = (headers: Record<string, string>): APIGatewayProxyEvent =>
  ({
    headers,
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

  test("returns 200 when bearer token matches secret", async () => {
    mockGetSecret.mockResolvedValue("correct-token");
    const result = await handler(
      makeEvent({ Authorization: "Bearer correct-token" }),
      {} as Context
    );
    expect(result.statusCode).toBe(200);
  });

  test("throws when NOTIFY_DELIVERY_RECEIPTS_SECRET_ARN is not set", async () => {
    delete process.env.NOTIFY_DELIVERY_RECEIPTS_SECRET_ARN;
    await expect(
      handler(makeEvent({ Authorization: "Bearer token" }), {} as Context)
    ).rejects.toThrow("NOTIFY_DELIVERY_RECEIPTS_SECRET_ARN not set");
  });
});
