import { Metrics } from "@aws-lambda-powertools/metrics";

export const initMetrics = (serviceName: string) => {
  return new Metrics({
    namespace: "account-management-backend",
    serviceName: serviceName,
  });
};
