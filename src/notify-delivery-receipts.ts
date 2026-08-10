import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { APIGatewayProxyHandler } from "./common/types.js";
import { Logger } from "@aws-lambda-powertools/logger";
import assert from "node:assert";
import { normalizeAPIGatewayProxyEventHandlerWrapper } from "./common/normalizeAPIGatewayProxyEventHandlerWrapper.js";
import * as v from "valibot";
import { MetricUnit } from "@aws-lambda-powertools/metrics";
import {
  initMetrics,
  metricsAPIGatewayProxyHandlerWrapper,
} from "./common/metrics.js";

const metrics = initMetrics("notify-delivery-receipts");

export const deliveryReceiptSchema = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({
    id: v.pipe(v.string(), v.uuid()),
    reference: v.nullable(v.string()),
    to: v.string(),
    status: v.picklist([
      "delivered",
      "permanent-failure",
      "temporary-failure",
      "technical-failure",
    ]),
    created_at: v.pipe(v.string(), v.isoTimestamp()),
    completed_at: v.nullable(v.pipe(v.string(), v.isoTimestamp())),
    sent_at: v.nullable(v.pipe(v.string(), v.isoTimestamp())),
    notification_type: v.picklist(["email", "sms"]),
    template_id: v.pipe(v.string(), v.uuid()),
    template_version: v.number(),
  })
);

const logger = new Logger();

export const handler: APIGatewayProxyHandler =
  normalizeAPIGatewayProxyEventHandlerWrapper(
    metricsAPIGatewayProxyHandlerWrapper(metrics, async (event) => {
      if (!event.headers["authorization"]) {
        logger.info("Authorization header not set");

        return {
          statusCode: 403,
          body: "",
        };
      }

      assert.ok(
        process.env["NOTIFY_DELIVERY_RECEIPTS_SECRET_ARN"],
        "NOTIFY_DELIVERY_RECEIPTS_SECRET_ARN not set"
      );

      if (
        event.headers["authorization"].split("Bearer ")[1] !==
        (await getSecret(process.env["NOTIFY_DELIVERY_RECEIPTS_SECRET_ARN"]))
      ) {
        logger.info("Invalid Authorization header value");

        return {
          statusCode: 403,
          body: "",
        };
      }

      const parsedBody = v.safeParse(deliveryReceiptSchema, event.body);

      if (!parsedBody.success) {
        logger.error("Request body failed validation", {
          errors: parsedBody.issues.map(({ path }) =>
            path?.map((p) => p.key).join(".")
          ),
        });

        return {
          statusCode: 400,
          body: "",
        };
      }

      const {
        id,
        reference,
        status,
        notification_type,
        template_id,
        created_at,
        completed_at,
        sent_at,
      } = parsedBody.output;

      metrics.addDimension("status", status);
      metrics.addDimension("notification_type", notification_type);
      metrics.addDimension("template_id", template_id);
      metrics.addMetric("NotifyDeliveryReceipt", MetricUnit.Count, 1);

      logger.info("Received Notify delivery receipt", {
        id,
        reference,
        status,
        notification_type,
        template_id,
        created_at,
        completed_at,
        sent_at,
      });

      return {
        statusCode: 200,
        body: "",
      };
    })
  );
