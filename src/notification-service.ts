import {
  Context,
  SQSEvent,
  SQSBatchResponse,
  SQSBatchItemFailure,
  SQSRecord,
} from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import * as v from "valibot";
import UAParser from "ua-parser-js";
import { NotifyClient } from "notifications-node-client";
import { randomUUID } from "node:crypto";
import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { getEnvironmentVariable } from "./common/utils";
import { isAxiosError } from "axios";

const logger = new Logger();

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
      logger.error("Secret is undefined", {
        messageId: record.messageId,
        key: notifyApiSecretKey,
      });
      batchItemFailures.push({ itemIdentifier: record.messageId });
      return;
    }
    if (typeof notifyApiKey !== "string") {
      logger.error("Secret is not a string", {
        messageId: record.messageId,
        key: notifyApiSecretKey,
      });
      batchItemFailures.push({ itemIdentifier: record.messageId });
      return;
    }
    notifyClient = new NotifyClient(notifyApiKey);
  }
  return notifyClient;
};

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
    logger.error("Message is not valid JSON", {
      messageId: record.messageId,
    });
    batchItemFailures.push({ itemIdentifier: record.messageId });
    return;
  }

  const messageParsed = v.safeParse(messageSchema, messageFromJson);
  if (!messageParsed.success) {
    logger.error("Invalid message format", {
      messageId: record.messageId,
    });
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
    logger.error("Template ID not available", {
      messageId: record.messageId,
      notificationType: message.notificationType,
    });
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
      logger.error("Unable to send notification", {
        messageId: record.messageId,
        notificationType: message.notificationType,
        status: error.response?.status,
        statusText: error.response?.statusText,
        details: error.response?.data,
      });
    } else {
      logger.error("Unable to send notification due to an unknown error", {
        messageId: record.messageId,
        notificationType: message.notificationType,
        details: error instanceof Error ? error.message : undefined,
      });
    }
    batchItemFailures.push({ itemIdentifier: record.messageId });
    return;
  }

  const resultParsed = v.safeParse(notifySuccessSchema, sendResult);
  if (!resultParsed.success) {
    logger.error("Invalid result format", {
      messageId: record.messageId,
      notificationType: message.notificationType,
    });
    batchItemFailures.push({ itemIdentifier: record.messageId });
    return;
  }

  logger.info("Successfully sent a notification", {
    messageId: record.messageId,
    id: resultParsed.output.data.id,
    reference: resultParsed.output.data.reference,
    notificationType: message.notificationType,
  });
};

export const handler = async (
  event: SQSEvent,
  context: Context
): Promise<SQSBatchResponse> => {
  logger.addContext(context);

  const batchItemFailures: SQSBatchItemFailure[] = [];

  await Promise.allSettled(
    event.Records.map((record) =>
      processNotification(record, batchItemFailures)
    )
  );

  return {
    batchItemFailures,
  };
};
