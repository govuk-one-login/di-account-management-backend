import { SQSBatchItemFailure, SQSRecord } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { NotifyClient } from "notifications-node-client";
import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { getEnvironmentVariable } from "./common/utils";
import { MetricUnit } from "@aws-lambda-powertools/metrics";
import { initMetrics } from "./common/metrics";

const logger = new Logger();
const metrics = initMetrics("notification-service");

const addNotificationFailedMetric = (failureReason: string) => {
  metrics.addDimension("failureReason", failureReason);
  metrics.addMetric("notificationFailed", MetricUnit.Count, 1);
};

let notifyClient: InstanceType<typeof NotifyClient> | undefined = undefined;

export const setUpNotifyClient = async (
  record: SQSRecord,
  batchItemFailures: SQSBatchItemFailure[]
) => {
  if (!notifyClient) {
    const notifyApiSecretKey = getEnvironmentVariable("NOTIFY_API_KEY");
    const notifyApiKey = await getSecret(notifyApiSecretKey, {
      maxAge: 900,
    });
    if (!notifyApiKey) {
      const errorName = "Secret is undefined";
      logger.error(errorName, {
        messageId: record.messageId,
        key: notifyApiSecretKey,
      });
      addNotificationFailedMetric(errorName);
      batchItemFailures.push({ itemIdentifier: record.messageId });
      return;
    }
    if (typeof notifyApiKey !== "string") {
      const errorName = "Secret is not a string";
      logger.error(errorName, {
        messageId: record.messageId,
        key: notifyApiSecretKey,
      });
      addNotificationFailedMetric(errorName);
      batchItemFailures.push({ itemIdentifier: record.messageId });
      return;
    }
    notifyClient = new NotifyClient(notifyApiKey);
  }
  return notifyClient;
};
