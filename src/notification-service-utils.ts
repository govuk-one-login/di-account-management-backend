import { SQSBatchItemFailure, SQSRecord } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import * as v from "valibot";
import UAParser from "ua-parser-js";
import { randomUUID } from "node:crypto";
import { getEnvironmentVariable } from "./common/utils.js";
import { isAxiosError } from "axios";
import { MetricUnit } from "@aws-lambda-powertools/metrics";
import { initMetrics } from "./common/metrics.js";
import { setUpNotifyClient } from "./notification-service-client.js";

const logger = new Logger();
const metrics = initMetrics("notification-service");

const addNotificationFailedMetric = (failureReason: string) => {
  metrics.addDimension("failureReason", failureReason);
  metrics.addMetric("notificationFailed", MetricUnit.Count, 1);
};

enum NotificationType {
  GLOBAL_LOGOUT = "GLOBAL_LOGOUT",
}

const missingContentPlaceholder = "-";

const messageSchema = v.variant("notificationType", [
  v.pipe(
    v.object({
      notificationType: v.literal(NotificationType.GLOBAL_LOGOUT),
      emailAddress: v.pipe(v.string(), v.email()),
      loggedOutAt: v.pipe(v.string(), v.isoTimestamp()),
      ipAddress: v.optional(v.pipe(v.string(), v.ip())),
      userAgent: v.optional(v.string()),
      countryCode: v.optional(v.string()),
    }),
    v.transform((input) => {
      const deviceInfo = input.userAgent
        ? UAParser(input.userAgent)
        : undefined;

      return {
        emailAddress: input.emailAddress,
        notificationType: input.notificationType,

        personalisation: {
          ipAddress: input.ipAddress ?? missingContentPlaceholder,

          browser: deviceInfo?.browser.name ?? missingContentPlaceholder,
          os: deviceInfo?.os.name ?? missingContentPlaceholder,
          deviceVendor: deviceInfo?.device.vendor ?? missingContentPlaceholder,
          deviceModel: deviceInfo?.device.model ?? missingContentPlaceholder,

          countryName_en: input.countryCode
            ? (new Intl.DisplayNames("en-gb", {
                type: "region",
              }).of(input.countryCode) ?? missingContentPlaceholder)
            : missingContentPlaceholder,

          countryName_cy: input.countryCode
            ? (new Intl.DisplayNames("cy-gb", {
                type: "region",
              }).of(input.countryCode) ?? missingContentPlaceholder)
            : missingContentPlaceholder,

          loggedOutAt_en: new Intl.DateTimeFormat("en-gb", {
            dateStyle: "full",
            timeStyle: "short",
            timeZone: "Europe/London",
          }).format(new Date(input.loggedOutAt)),

          loggedOutAt_cy: new Intl.DateTimeFormat("cy-gb", {
            dateStyle: "full",
            timeStyle: "short",
            timeZone: "Europe/London",
          }).format(new Date(input.loggedOutAt)),
        },
      };
    })
  ),
]);

const notifySuccessSchema = v.object({
  data: v.object({
    id: v.string(),
    reference: v.nullish(v.string()),
  }),
});

const templateIDsSchema = v.record(v.enum(NotificationType), v.string());

const notifyTemplateIds = v.parse(
  templateIDsSchema,
  JSON.parse(getEnvironmentVariable("NOTIFY_TEMPLATE_IDS"))
);

export const processNotification = async (
  record: SQSRecord,
  batchItemFailures: SQSBatchItemFailure[]
) => {
  const notifyClient = await setUpNotifyClient(record, batchItemFailures);
  if (!notifyClient) {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let messageFromJson: any;
  try {
    messageFromJson = JSON.parse(record.body);
  } catch {
    const errorName = "Message is not valid JSON";
    logger.error(errorName, {
      messageId: record.messageId,
    });
    addNotificationFailedMetric(errorName);
    batchItemFailures.push({ itemIdentifier: record.messageId });
    return;
  }

  const messageParsed = v.safeParse(messageSchema, messageFromJson);
  if (!messageParsed.success) {
    const errorName = "Invalid message format";
    logger.error(errorName, {
      messageId: record.messageId,
    });
    addNotificationFailedMetric(errorName);
    batchItemFailures.push({ itemIdentifier: record.messageId });
    return;
  }

  const message: {
    emailAddress: string;
    notificationType: NotificationType;
    personalisation: Record<string, string>;
  } = messageParsed.output;

  const templateId = notifyTemplateIds[message.notificationType];
  if (!templateId) {
    const errorName = "Template ID not found";
    logger.error(errorName, {
      messageId: record.messageId,
      notificationType: message.notificationType,
    });
    addNotificationFailedMetric(errorName);
    batchItemFailures.push({ itemIdentifier: record.messageId });
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sendResult: any;
  try {
    sendResult = await notifyClient.sendEmail(
      templateId,
      message.emailAddress,
      {
        personalisation: message.personalisation,
        reference: randomUUID(),
      }
    );
  } catch (error) {
    if (isAxiosError(error)) {
      const errorName = "Unable to send notification";
      logger.error(errorName, {
        messageId: record.messageId,
        notificationType: message.notificationType,
        status: error.response?.status,
        statusText: error.response?.statusText,
        details: error.response?.data,
      });
      addNotificationFailedMetric(errorName);
    } else {
      const errorName = "Unable to send notification due to an unknown error";
      logger.error(errorName, {
        messageId: record.messageId,
        notificationType: message.notificationType,
        details: error instanceof Error ? error.message : undefined,
      });
      addNotificationFailedMetric(errorName);
    }
    batchItemFailures.push({ itemIdentifier: record.messageId });
    return;
  }

  const resultParsed = v.safeParse(notifySuccessSchema, sendResult);
  if (!resultParsed.success) {
    const errorName = "Invalid result format";
    logger.error(errorName, {
      messageId: record.messageId,
      notificationType: message.notificationType,
    });
    addNotificationFailedMetric(errorName);
    batchItemFailures.push({ itemIdentifier: record.messageId });
    return;
  }

  logger.info("Successfully sent a notification", {
    messageId: record.messageId,
    id: resultParsed.output.data.id,
    reference: resultParsed.output.data.reference,
    notificationType: message.notificationType,
  });
  metrics.addMetric("notificationSent", MetricUnit.Count, 1);
};
