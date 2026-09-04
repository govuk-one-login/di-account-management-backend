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
import { IadEvent } from "./common/send-audit-event.js";

const logger = new Logger();
const metrics = initMetrics("notification-service");

const addNotificationFailedMetric = (failureReason: string) => {
  metrics.addDimension("failureReason", failureReason);
  metrics.addMetric("notificationFailed", MetricUnit.Count, 1);
};

type NotificationConfig = Record<
  string,
  {
    name: string;
    auditEvent?: IadEvent;
    auditEventNotificationType?: string
  }
>;

export const notificationConfiguration: NotificationConfig = {
  "GLOBAL_LOGOUT": { 
    name: "GLOBAL_LOGOUT"
  },
  "INACTIVE_ACCOUNT_WARNING_30_DAY": { 
    name: "INACTIVE_ACCOUNT_WARNING_30_DAY",
    auditEvent: "HOME_ACCOUNT_TRACKER_NOTIFICATION_REQUESTED", 
    auditEventNotificationType: "30DayWarning"
  },
  "INACTIVE_ACCOUNT_WARNING_7_DAY": { 
    name: "INACTIVE_ACCOUNT_WARNING_7_DAY",
    auditEvent:"HOME_ACCOUNT_TRACKER_NOTIFICATION_REQUESTED", 
    auditEventNotificationType: "7DayWarning"
  },
  "INACTIVE_ACCOUNT_SAVED_APP": { 
    name: "INACTIVE_ACCOUNT_SAVED_APP",
    auditEvent:"HOME_ACCOUNT_TRACKER_NOTIFICATION_REQUESTED", 
    auditEventNotificationType: "RecoveryViaApp"
  },
  "INACTIVE_ACCOUNT_SAVED_HOME": { 
    name: "INACTIVE_ACCOUNT_SAVED_HOME",
    auditEvent:"HOME_ACCOUNT_TRACKER_NOTIFICATION_REQUESTED", 
    auditEventNotificationType: "RecoveryViaHome"
  },
  "INACTIVE_ACCOUNT_SAVED_RP": { 
    name: "INACTIVE_ACCOUNT_SAVED_RP",
    auditEvent:"HOME_ACCOUNT_TRACKER_NOTIFICATION_REQUESTED", 
    auditEventNotificationType: "Recovery"
  },
  "INACTIVE_ACCOUNT_DELETED_CONFIRMATION": { 
    name: "INACTIVE_ACCOUNT_DELETED_CONFIRMATION",
    auditEvent:"HOME_ACCOUNT_TRACKER_NOTIFICATION_REQUESTED", 
    auditEventNotificationType: "Deletion"
  },
}

const missingContentPlaceholder = "-";

const messageSchema = v.variant("notificationType", [
  v.pipe(
    v.object({
      notificationType: v.literal(notificationConfiguration.GLOBAL_LOGOUT.name),
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
  v.pipe(
    v.object({
      notificationType: v.literal(
        notificationConfiguration.INACTIVE_ACCOUNT_WARNING_30_DAY.name
      ),
      emailAddress: v.pipe(v.string(), v.email()),
      dateForDeletion: v.string(),
    }),
    v.transform((input) => {
      const deletionDate = new Date(input.dateForDeletion);

      return {
        emailAddress: input.emailAddress,
        notificationType: input.notificationType,

        personalisation: {
          emailAddress: input.emailAddress,
          deletionDate_en: new Intl.DateTimeFormat("en-gb", {
            dateStyle: "long",
            timeZone: "Europe/London",
          }).format(deletionDate),
          deletionDate_cy: new Intl.DateTimeFormat("cy-gb", {
            dateStyle: "long",
            timeZone: "Europe/London",
          }).format(deletionDate),
        },
      };
    })
  ),
  v.pipe(
    v.object({
      notificationType: v.literal(
        notificationConfiguration.INACTIVE_ACCOUNT_WARNING_7_DAY.name
      ),
      emailAddress: v.pipe(v.string(), v.email()),
      dateForDeletion: v.string(),
    }),
    v.transform((input) => {
      const deletionDate = new Date(input.dateForDeletion);

      return {
        emailAddress: input.emailAddress,
        notificationType: input.notificationType,

        personalisation: {
          emailAddress: input.emailAddress,
          deletionDate_en: new Intl.DateTimeFormat("en-gb", {
            dateStyle: "long",
            timeZone: "Europe/London",
          }).format(deletionDate),
          deletionDate_cy: new Intl.DateTimeFormat("cy-gb", {
            dateStyle: "long",
            timeZone: "Europe/London",
          }).format(deletionDate),
        },
      };
    })
  ),
  v.pipe(
    v.object({
      notificationType: v.literal(notificationConfiguration.INACTIVE_ACCOUNT_SAVED_APP.name),
      emailAddress: v.pipe(v.string(), v.email()),
    }),
    v.transform((input) => {
      return {
        emailAddress: input.emailAddress,
        notificationType: input.notificationType,

        personalisation: {
          emailAddress: input.emailAddress,
        },
      };
    })
  ),
  v.pipe(
    v.object({
      notificationType: v.literal(notificationConfiguration.INACTIVE_ACCOUNT_SAVED_HOME.name),
      emailAddress: v.pipe(v.string(), v.email()),
    }),
    v.transform((input) => {
      return {
        emailAddress: input.emailAddress,
        notificationType: input.notificationType,

        personalisation: {
          emailAddress: input.emailAddress,
        },
      };
    })
  ),
  v.pipe(
    v.object({
      notificationType: v.literal(notificationConfiguration.INACTIVE_ACCOUNT_SAVED_RP.name),
      emailAddress: v.pipe(v.string(), v.email()),
    }),
    v.transform((input) => {
      return {
        emailAddress: input.emailAddress,
        notificationType: input.notificationType,

        personalisation: {
          emailAddress: input.emailAddress,
        },
      };
    })
  ),
  v.pipe(
    v.object({
      notificationType: v.literal(
        notificationConfiguration.INACTIVE_ACCOUNT_DELETED_CONFIRMATION.name
      ),
      emailAddress: v.pipe(v.string(), v.email()),
    }),
    v.transform((input) => {
      return {
        emailAddress: input.emailAddress,
        notificationType: input.notificationType,

        personalisation: {
          emailAddress: input.emailAddress,
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

const templateIDsSchema = v.record(
  v.picklist(Object.keys(notificationConfiguration) as (keyof typeof notificationConfiguration)[]), 
  v.string()
);

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
    notificationType: keyof typeof notificationConfiguration;
    personalisation?: Record<string, string>;
  } = messageParsed.output;

  const reference = randomUUID();
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

  if (
    process.env["NOTIFY_DONT_SEND_EMAILS_TO"] &&
    new RegExp(process.env["NOTIFY_DONT_SEND_EMAILS_TO"], "i").test(
      message.emailAddress
    )
  ) {
    logger.info("test_email_address_detected", {
      reference: reference,
      templateId,
      notificationType: message.notificationType,
    });
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
        reference: reference,
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
