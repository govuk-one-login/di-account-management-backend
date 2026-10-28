// Unit tests for the pre-merge integration-suite config helpers. These are pure
// env-driven getters, so they run in the normal `npm test` unit run (the file is
// intentionally named `.test.ts`, not `.integration.test.ts`).

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  AWS_REGION,
  getNotifySecretArn,
  getPublicApiBaseUrl,
  getQueueUrl,
  MissingConfigError,
  notifyTestsConfigured,
  TABLES,
} from "../config.js";

const ENV_KEYS = [
  "SQS_QUEUE_ARN",
  "PUBLIC_API_BASE_URL",
  "NOTIFY_DELIVERY_RECEIPTS_SECRET_ARN",
] as const;

describe("config", () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
  });

  describe("constants", () => {
    it("exposes the expected region", () => {
      expect(AWS_REGION).toBe("eu-west-2");
    });

    it("exposes the expected table names", () => {
      expect(TABLES).toStrictEqual({
        ACTIVITY_LOG: "activity_log",
        USER_SERVICES: "user_services",
        INACTIVE_ACCOUNT_TRACKER: "inactive_account_tracker_store",
      });
    });
  });

  describe("getQueueUrl", () => {
    it("returns undefined when SQS_QUEUE_ARN is unset", () => {
      expect(getQueueUrl()).toBeUndefined();
    });

    it("returns the raw value when SQS_QUEUE_ARN is set", () => {
      process.env.SQS_QUEUE_ARN =
        "https://sqs.eu-west-2.amazonaws.com/123/queue";
      expect(getQueueUrl()).toBe(
        "https://sqs.eu-west-2.amazonaws.com/123/queue"
      );
    });

    it("reads the value lazily at call time", () => {
      expect(getQueueUrl()).toBeUndefined();
      process.env.SQS_QUEUE_ARN = "set-later";
      expect(getQueueUrl()).toBe("set-later");
    });
  });

  describe("getPublicApiBaseUrl", () => {
    it("returns undefined when unset", () => {
      expect(getPublicApiBaseUrl()).toBeUndefined();
    });

    it("passes through an empty string unchanged", () => {
      process.env.PUBLIC_API_BASE_URL = "";
      expect(getPublicApiBaseUrl()).toBe("");
    });

    it("returns a URL without a trailing slash unchanged", () => {
      process.env.PUBLIC_API_BASE_URL = "https://api.example.gov.uk";
      expect(getPublicApiBaseUrl()).toBe("https://api.example.gov.uk");
    });

    it("strips exactly one trailing slash", () => {
      process.env.PUBLIC_API_BASE_URL = "https://api.example.gov.uk/";
      expect(getPublicApiBaseUrl()).toBe("https://api.example.gov.uk");
    });

    it("strips only a single trailing slash, leaving the rest", () => {
      process.env.PUBLIC_API_BASE_URL = "https://api.example.gov.uk//";
      expect(getPublicApiBaseUrl()).toBe("https://api.example.gov.uk/");
    });
  });

  describe("getNotifySecretArn", () => {
    it("returns undefined when unset", () => {
      expect(getNotifySecretArn()).toBeUndefined();
    });

    it("returns the raw value when set", () => {
      process.env.NOTIFY_DELIVERY_RECEIPTS_SECRET_ARN = "arn:aws:secret:xyz"; // pragma: allowlist secret
      expect(getNotifySecretArn()).toBe("arn:aws:secret:xyz");
    });
  });

  describe("notifyTestsConfigured", () => {
    it("is false when neither variable is set", () => {
      expect(notifyTestsConfigured()).toBe(false);
    });

    it("is false when only the base URL is set", () => {
      process.env.PUBLIC_API_BASE_URL = "https://api.example.gov.uk";
      expect(notifyTestsConfigured()).toBe(false);
    });

    it("is false when only the secret ARN is set", () => {
      process.env.NOTIFY_DELIVERY_RECEIPTS_SECRET_ARN = "arn:aws:secret:xyz"; // pragma: allowlist secret
      expect(notifyTestsConfigured()).toBe(false);
    });

    it("is false when either value is an empty string", () => {
      process.env.PUBLIC_API_BASE_URL = "";
      process.env.NOTIFY_DELIVERY_RECEIPTS_SECRET_ARN = "arn:aws:secret:xyz"; // pragma: allowlist secret
      expect(notifyTestsConfigured()).toBe(false);
    });

    it("is true when both variables are set to non-empty values", () => {
      process.env.PUBLIC_API_BASE_URL = "https://api.example.gov.uk";
      process.env.NOTIFY_DELIVERY_RECEIPTS_SECRET_ARN = "arn:aws:secret:xyz"; // pragma: allowlist secret
      expect(notifyTestsConfigured()).toBe(true);
    });
  });

  describe("MissingConfigError", () => {
    it("records the variable name and builds a descriptive message", () => {
      const error = new MissingConfigError("SQS_QUEUE_ARN");
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("MissingConfigError");
      expect(error.variableName).toBe("SQS_QUEUE_ARN");
      expect(error.message).toBe(
        "Required configuration variable is missing: SQS_QUEUE_ARN"
      );
    });
  });
});
