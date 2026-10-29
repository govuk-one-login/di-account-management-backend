// Real-AWS / real-public-API integration tests (run only via
// `npm run test:integration`): the Notify delivery-receipts endpoint auth and
// body validation. Must NOT mock anything. Gated behind notifyTestsConfigured()
// so they are skipped (not failed) when the required config is absent.

import { describe, expect, it } from "vitest";

import {
  getNotifySecretArn,
  getPublicApiBaseUrl,
  notifyTestsConfigured,
  MissingConfigError,
} from "../config.js";
import { generateEventId, httpPost } from "../helpers.js";
import { getSecret } from "../aws-helpers.js";

// Kept as a `type` (not `interface`) so the shape structurally satisfies
// httpPost's `Record<string, unknown>` payload parameter; interfaces lack the
// implicit index signature that assignment requires.
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type NotifyDeliveryReceipt = {
  id: string;
  reference: "12345678";
  to: "hello@gov.uk";
  status: "delivered";
  created_at: string;
  completed_at: string;
  sent_at: string;
  notification_type: "email";
  template_id: string;
  template_version: 1;
};

function deliveryReceiptsUrl(): string {
  const baseUrl = getPublicApiBaseUrl();
  if (typeof baseUrl !== "string" || baseUrl.length === 0) {
    throw new MissingConfigError("PUBLIC_API_BASE_URL");
  }
  return `${baseUrl}/notify/delivery-receipts`;
}

async function getNotifyBearerToken(): Promise<string> {
  const arn = getNotifySecretArn();
  if (typeof arn !== "string" || arn.length === 0) {
    throw new MissingConfigError("NOTIFY_DELIVERY_RECEIPTS_SECRET_ARN"); // pragma: allowlist secret
  }

  try {
    return await getSecret(arn);
  } catch (error) {
    throw new Error(
      "Could not obtain the Notify delivery-receipts bearer token from " +
        `Secrets Manager; no request was sent. Cause: ${String(error)}`,
      { cause: error }
    );
  }
}

function validNotifyBody(): NotifyDeliveryReceipt {
  return {
    id: generateEventId(),
    reference: "12345678",
    to: "hello@gov.uk",
    status: "delivered",
    created_at: "2017-05-14T12:15:30.000000Z",
    completed_at: "2017-05-14T12:15:30.000000Z",
    sent_at: "2017-05-14T12:15:30.000000Z",
    notification_type: "email",
    template_id: generateEventId(),
    template_version: 1,
  };
}

describe.skipIf(!notifyTestsConfigured())(
  "notify-delivery-receipts (requires PUBLIC_API_BASE_URL and NOTIFY_DELIVERY_RECEIPTS_SECRET_ARN)",
  () => {
    it.concurrent(
      "returns 403 for a POST with no Authorization header",
      async () => {
        const { status } = await httpPost(deliveryReceiptsUrl(), {});

        expect(status, `Expected 403 for a no-auth POST, got ${status}`).toBe(
          403
        );
      }
    );

    it.concurrent(
      "returns 403 for a POST with an incorrect bearer token",
      async () => {
        const { status } = await httpPost(
          deliveryReceiptsUrl(),
          {},
          { Authorization: "Bearer wrong-token" }
        );

        expect(
          status,
          `Expected 403 for a wrong-token POST, got ${status}`
        ).toBe(403);
      }
    );

    it.concurrent(
      "returns 400 for a correct-token POST with an invalid body",
      async () => {
        const token = await getNotifyBearerToken();

        const { status } = await httpPost(
          deliveryReceiptsUrl(),
          {},
          { Authorization: `Bearer ${token}` }
        );

        expect(
          status,
          `Expected 400 for a correct-token invalid-body POST, got ${status}`
        ).toBe(400);
      }
    );

    it.concurrent(
      "returns 200 for a correct-token POST with a valid Notify body",
      async () => {
        const token = await getNotifyBearerToken();

        const { status } = await httpPost(
          deliveryReceiptsUrl(),
          validNotifyBody(),
          { Authorization: `Bearer ${token}` }
        );

        expect(
          status,
          `Expected 200 for a correct-token valid-body POST, got ${status}`
        ).toBe(200);
      }
    );
  }
);
