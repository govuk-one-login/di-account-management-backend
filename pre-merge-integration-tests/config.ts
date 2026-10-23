// Env reads happen at call time (inside the getters) rather than at module
// load, so tests can set/unset process.env between calls.

export const TABLES = {
  ACTIVITY_LOG: "activity_log",
  USER_SERVICES: "user_services",
  INACTIVE_ACCOUNT_TRACKER: "inactive_account_tracker_store",
} as const;

export const AWS_REGION = "eu-west-2";

// Removes exactly one trailing slash (unlike Python's rstrip('/'), which strips
// all of them); pure, exported for testing.
export function stripOneTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

// Named SQS_QUEUE_ARN for historical CI reasons but holds a Queue URL.
export function getQueueUrl(): string | undefined {
  return process.env.SQS_QUEUE_ARN;
}

export function getPublicApiBaseUrl(): string | undefined {
  const value = process.env.PUBLIC_API_BASE_URL;
  if (typeof value === "string" && value.length > 0) {
    return stripOneTrailingSlash(value);
  }
  return value;
}

export function getNotifySecretArn(): string | undefined {
  return process.env.NOTIFY_DELIVERY_RECEIPTS_SECRET_ARN;
}

// True only when both PUBLIC_API_BASE_URL and NOTIFY_DELIVERY_RECEIPTS_SECRET_ARN
// are set to non-empty values.
export function notifyTestsConfigured(): boolean {
  const baseUrl = process.env.PUBLIC_API_BASE_URL;
  const arn = process.env.NOTIFY_DELIVERY_RECEIPTS_SECRET_ARN;
  return (
    typeof baseUrl === "string" &&
    baseUrl.length > 0 &&
    typeof arn === "string" &&
    arn.length > 0
  );
}

export class MissingConfigError extends Error {
  constructor(public readonly variableName: string) {
    super(`Required configuration variable is missing: ${variableName}`);
    this.name = "MissingConfigError";
  }
}
