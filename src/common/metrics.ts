import { Metrics } from "@aws-lambda-powertools/metrics";
import { APIGatewayProxyHandler } from "./types.js";

export const initMetrics = (serviceName: string) => {
  return new Metrics({
    namespace: "account-management-backend",
    serviceName: serviceName,
  });
};

export const metricsAPIGatewayProxyHandlerWrapper = (
  metrics: Metrics,
  handler: APIGatewayProxyHandler
): APIGatewayProxyHandler => {
  const wrappedHandler: APIGatewayProxyHandler = async (event, context) => {
    try {
      const res = await handler(event, context);
      metrics.captureColdStartMetric();
      metrics.publishStoredMetrics();
      return res;
    } catch (error) {
      metrics.captureColdStartMetric();
      metrics.publishStoredMetrics();
      throw error;
    }
  };
  return wrappedHandler;
};
