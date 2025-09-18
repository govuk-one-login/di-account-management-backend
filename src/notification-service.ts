import {
  Context,
  SQSEvent,
  SQSBatchResponse,
  SQSBatchItemFailure,
} from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import * as v from "valibot";
import UAParser from "ua-parser-js";
import { NotifyClient } from "notifications-node-client";
import { randomUUID } from "node:crypto";
import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { getEnvironmentVariable } from "./common/utils";
import assert from "node:assert";
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
      ipAddress: v.fallback(
        v.pipe(v.string(), v.ip()),
        missingContentPlaceholder
      ),
      userAgent: v.optional(v.string()),
      countryCode: v.optional(v.string()),
    }),
    v.transform((input) => {
      const deviceInfo = input.userAgent
        ? UAParser(input.userAgent)
        : undefined;

      return {
        ...input,

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

export const handler = async (
  event: SQSEvent,
  context: Context
): Promise<SQSBatchResponse> => {
  try {
    logger.addContext(context);

    const notifyTemplateIds = v.parse(
      templateIDsSchema,
      JSON.parse(getEnvironmentVariable("NOTIFY_TEMPLATE_IDS"))
    );

    const NOTIFY_API_KEY = getEnvironmentVariable("NOTIFY_API_KEY");
    const notifyApiKey = await getSecret(NOTIFY_API_KEY, {
      maxAge: 900,
    });
    assert.ok(notifyApiKey, `${NOTIFY_API_KEY} secret is undefined`);
    assert.ok(
      typeof notifyApiKey === "string",
      `${NOTIFY_API_KEY} secret is not a string`
    );

    const notify = new NotifyClient(notifyApiKey);

    const batchItemFailures: SQSBatchItemFailure[] = [];

    await Promise.allSettled(
      event.Records.map(async (record) => {
        try {
          const message = v.parse(messageSchema, JSON.parse(record.body));

          const templateId = notifyTemplateIds[message.notificationType];

          assert.ok(
            templateId,
            `Template ID not available for ${message.notificationType}`
          );

          const result = await notify.sendEmail(
            templateId,
            message.emailAddress,
            {
              personalisation: {
                ipAddress: message.ipAddress,
                loggedOutAt_en: message.loggedOutAt_en,
                loggedOutAt_cy: message.loggedOutAt_cy,
                countryName_en: message.countryName_en,
                countryName_cy: message.countryName_cy,
                browser: message.browser,
                os: message.os,
                deviceVendor: message.deviceVendor,
                deviceModel: message.deviceModel,
              },
              reference: randomUUID(),
            }
          );

          try {
            const parsedResult = v.parse(notifySuccessSchema, result);

            logger.info("Successfully sent a notification", {
              messageId: record.messageId,
              id: parsedResult.data.id,
              reference: parsedResult.data.reference,
            });
          } catch (error) {
            logger.error("Error occurred after sending a notification", {
              messageId: record.messageId,
              error: isAxiosError(error) ? error.response?.data : error,
            });
          }
        } catch (error) {
          logger.error("Error occurred when sending a notification", {
            messageId: record.messageId,
            error: isAxiosError(error) ? error.response?.data : error,
          });

          batchItemFailures.push({ itemIdentifier: record.messageId });
        }
      })
    );

    return {
      batchItemFailures,
    };
  } catch (error) {
    logger.error("Error occurred when sending notifications", {
      error,
    });

    return {
      batchItemFailures: event.Records.map((record) => ({
        itemIdentifier: record.messageId,
      })),
    };
  }
};
