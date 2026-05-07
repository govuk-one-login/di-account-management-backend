import { vi, describe, test, expect } from "vitest";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { initMetrics } from "../common/metrics";

vi.mock("@aws-lambda-powertools/metrics");

describe("initMetrics", () => {
  test("creates Metrics instance with correct configuration", () => {
    const serviceName = "test-service";
    const mockMetrics = vi.mocked(Metrics);

    initMetrics(serviceName);

    expect(mockMetrics).toHaveBeenCalledWith({
      namespace: "account-management-backend",
      serviceName,
    });
  });
});
