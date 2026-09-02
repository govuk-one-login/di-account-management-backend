import { SQSBatchItemFailure, SQSRecord } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { NotifyClient } from "notifications-node-client";
import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { getEnvironmentVariable } from "./common/utils.js";
import { MetricUnit } from "@aws-lambda-powertools/metrics";
import { initMetrics } from "./common/metrics.js";

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
    const notifyApiSecretArn = getEnvironmentVariable("NOTIFY_API_KEY_SECRET_ARN");
    const notifyApiKey = await getSecret(notifyApiSecretArn, {
      maxAge: 900,
    });
    if (!notifyApiKey) {
      const errorName = "Secret is undefined";
      logger.error(errorName, {
        messageId: record.messageId,
        arn: notifyApiSecretArn,
      });
      addNotificationFailedMetric(errorName);
      batchItemFailures.push({ itemIdentifier: record.messageId });
      return;
    }
    if (typeof notifyApiKey !== "string") {
      const errorName = "Secret is not a string";
      logger.error(errorName, {
        messageId: record.messageId,
        arn: notifyApiSecretArn,
      });
      addNotificationFailedMetric(errorName);
      batchItemFailures.push({ itemIdentifier: record.messageId });
      return;
    }
    notifyClient = new NotifyClient(notifyApiKey);
  }
  return notifyClient;
};
