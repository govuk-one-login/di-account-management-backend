import { Metrics } from "@aws-lambda-powertools/metrics";
import { initMetrics } from "../common/metrics";

jest.mock("@aws-lambda-powertools/metrics");

describe("initMetrics", () => {
  test("creates Metrics instance with correct configuration", () => {
    const serviceName = "test-service";
    const mockMetrics = jest.mocked(Metrics);

    initMetrics(serviceName);

    expect(mockMetrics).toHaveBeenCalledWith({
      namespace: "account-management-backend",
      serviceName,
    });
  });
});
