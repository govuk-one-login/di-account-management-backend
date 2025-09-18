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

const logger = new Logger();

enum NotificationType {
  GLOBAL_LOGOUT = "GLOBAL_LOGOUT",
}

const messageSchema = v.variant("notificationType", [
  v.pipe(
    v.object({
      notificationType: v.literal(NotificationType.GLOBAL_LOGOUT),
      emailAddress: v.pipe(v.string(), v.email()),
      loggedOutAt: v.pipe(v.string(), v.isoTimestamp()),
      ipAddress: v.pipe(v.string(), v.ip()),
      userAgent: v.string(),
      countryCode: v.string(),
    }),
    v.transform((input) => {
      const deviceInfo = UAParser(input.userAgent);
      return {
        ...input,
        browser: deviceInfo.browser.name,
        os: deviceInfo.os.name,
        deviceVendor: deviceInfo.device.vendor,
        deviceModel: deviceInfo.device.model,
        countryName_en: new Intl.DisplayNames("en", {
          type: "region",
        }).of(input.countryCode),
        countryName_cy: new Intl.DisplayNames("cy", {
          type: "region",
        }).of(input.countryCode),
        loggedOutAt_en: new Intl.DateTimeFormat("en", {
          dateStyle: "full",
          timeStyle: "short",
          timeZone: "Europe/London",
        }).format(new Date(input.loggedOutAt)),
        loggedOutAt_cy: new Intl.DateTimeFormat("cy", {
          dateStyle: "full",
          timeStyle: "short",
          timeZone: "Europe/London",
        }).format(new Date(input.loggedOutAt)),
      };
    })
  ),
]);

const notifySuccessSchema = v.object({
  response: v.object({
    data: v.object({
      id: v.string(),
      reference: v.optional(v.string()),
      content: v.object({
        subject: v.string(),
        body: v.string(),
        from_email: v.pipe(v.string(), v.email()),
        one_click_unsubscribe_url: v.optional(v.pipe(v.string(), v.url())),
      }),
      uri: v.pipe(v.string(), v.url()),
      template: v.object({
        id: v.string(),
        version: v.pipe(v.number(), v.integer()),
        uri: v.pipe(v.string(), v.url()),
      }),
    }),
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
              personalisation: message,
              reference: randomUUID(),
            }
          );

          const parsedResult = v.parse(notifySuccessSchema, result);

          logger.info("Successfully sent a notification", {
            messageId: record.messageId,
            id: parsedResult.response.data.id,
            reference: parsedResult.response.data.reference,
          });
        } catch (error) {
          logger.error("Error occurred when sending a notification", {
            messageId: record.messageId,
            error,
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
