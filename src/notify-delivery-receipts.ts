import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { APIGatewayProxyHandler } from "./common/types.js";
import { Logger } from "@aws-lambda-powertools/logger";
import assert from "node:assert";
import { normalizeAPIGatewayProxyEventHandlerWrapper } from "./common/normalizeAPIGatewayProxyEventHandlerWrapper.js";

const logger = new Logger();

export const handler: APIGatewayProxyHandler =
  normalizeAPIGatewayProxyEventHandlerWrapper(async (event) => {
    if (!event.headers["authorization"]) {
      logger.info("Authorization header not set");

      return {
        statusCode: 403,
        body: "TODO1 remove body value",
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
        body: "TODO2 remove body value",
      };
    }

    return {
      statusCode: 200,
      body: "TODO3 remove body value",
    };
  });
