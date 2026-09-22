import { vi, describe, test, expect, beforeEach } from "vitest";
import { Metrics } from "@aws-lambda-powertools/metrics";
import {
  initMetrics,
  metricsAPIGatewayProxyHandlerWrapper,
} from "../common/metrics.js";
import { APIGatewayProxyEvent, Context } from "aws-lambda";

vi.mock("@aws-lambda-powertools/metrics");

const mockMetrics = {
  captureColdStartMetric: vi.fn(),
  publishStoredMetrics: vi.fn(),
} as unknown as Metrics;

const mockEvent = {} as APIGatewayProxyEvent;
const mockContext = {} as Context;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("initMetrics", () => {
  test("creates Metrics instance with correct configuration", () => {
    initMetrics("test-service");
    expect(vi.mocked(Metrics)).toHaveBeenCalledWith({
      namespace: "account-management-backend",
      serviceName: "test-service",
    });
  });
});

describe("metricsAPIGatewayProxyHandlerWrapper", () => {
  test("returns the handler response", async () => {
    const handler = vi.fn().mockResolvedValue({ statusCode: 200, body: "" });
    const result = await metricsAPIGatewayProxyHandlerWrapper(
      mockMetrics,
      handler
    )(mockEvent, mockContext);
    expect(result.statusCode).toBe(200);
  });

  test("captures cold start metric and publishes on success", async () => {
    const handler = vi.fn().mockResolvedValue({ statusCode: 200, body: "" });
    await metricsAPIGatewayProxyHandlerWrapper(mockMetrics, handler)(
      mockEvent,
      mockContext
    );
    expect(mockMetrics.captureColdStartMetric).toHaveBeenCalledOnce();
    expect(mockMetrics.publishStoredMetrics).toHaveBeenCalledOnce();
  });

  test("captures cold start metric and publishes before rethrowing on error", async () => {
    const error = new Error("handler error");
    const handler = vi.fn().mockRejectedValue(error);
    await expect(
      metricsAPIGatewayProxyHandlerWrapper(mockMetrics, handler)(
        mockEvent,
        mockContext
      )
    ).rejects.toThrow("handler error");
    expect(mockMetrics.captureColdStartMetric).toHaveBeenCalledOnce();
    expect(mockMetrics.publishStoredMetrics).toHaveBeenCalledOnce();
  });
});
