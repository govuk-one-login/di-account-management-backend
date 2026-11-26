// Manifest of every Lambda in template.yaml, used by `npm run local:invoke`.
//
// For each function this records how to load the handler and which environment
// variables to set for a local run. It is hand-written: tests/functions.test.ts
// fails when it drifts from template.yaml (a function added/removed/renamed, a
// different handler, or an env var added/removed). Values are NOT compared.
//
// Status:
//   verified   - covered by `npm run local:verify` against the emulator.
//   unverified - the handler loads and runs, but it relies on AWS operations
//                that are not covered (see `notes`) so it may fail with
//                `NotImplemented` or behave differently from real AWS.

import { STACK_NAME } from "./config.ts";

const LOCAL_ENVIRONMENT = "dev";

/** Placeholder for config that has no local equivalent. */
const UNAVAILABLE = "unavailable-locally";

export const TABLES = {
  userServices: "user_services",
  rawEvents: "raw_events",
  activityLog: "activity_log",
  tracker: "inactive_account_tracker_store",
  forecast: "inactive_account_daily_deletion_forecast",
  circuitBreaker: "inactive_account_circuit_breaker",
  userNotifications: "user_notifications",
  stubOutputs: `${STACK_NAME}-IntegrationTestStubApiOutputs`,
} as const;

/**
 * - string: used as is
 * - { queue }: URL of the SQS queue created for that template logical id
 * - { key }: ARN of one of the KMS keys created by bootstrap
 */
export type EnvValue =
  | string
  | { queue: string }
  | { key: "generator" | "wrapper" | "backupWrapper" };

type Trigger =
  | "sqs"
  | "dynamodb-stream"
  | "api-gateway"
  | "schedule"
  | "step-function"
  | "invoke";

export interface LocalFunction {
  /** Short name used on the command line. */
  name: string;
  /** Logical id of the AWS::Serverless::Function in template.yaml. */
  logicalId: string;
  /** Handler as in template.yaml, e.g. "write-activity-log.handler". */
  handler: string;
  /** What invokes it in AWS, which decides the shape of the event. */
  trigger: Trigger;
  status: "verified" | "unverified";
  /** For unverified functions: what is not covered. */
  notes?: string;
  /** Must have exactly the keys of Environment.Variables in the template. */
  env: Record<string, EnvValue>;
}

const NODE_OPTIONS = "--enable-source-maps";
const NOTIFY_TEMPLATE_IDS = JSON.stringify({
  GLOBAL_LOGOUT: "local-template-id",
  INACTIVE_ACCOUNT_WARNING_30_DAY: "local-template-id",
  INACTIVE_ACCOUNT_WARNING_7_DAY: "local-template-id",
  INACTIVE_ACCOUNT_SAVED_APP: "local-template-id",
  INACTIVE_ACCOUNT_SAVED_HOME: "local-template-id",
  INACTIVE_ACCOUNT_SAVED_RP: "local-template-id",
  INACTIVE_ACCOUNT_DELETED_CONFIRMATION: "local-template-id",
});

const NOTIFY_NOTE =
  "Calls the GOV.UK Notify API / reads a Notify secret, which has no local equivalent.";
const SNS_NOTE =
  "Uses SNS Publish, which is not covered by the compatibility check.";
const SFN_NOTE =
  "Uses Step Functions StartExecution, which is not covered by the compatibility check.";
const TRANSACT_NOTE =
  "Uses TransactWriteItems / conditional UpdateItem, which are not covered by the compatibility check.";

export const FUNCTIONS: LocalFunction[] = [
  // ---------------------------------------------------------------- verified
  {
    name: "save-raw-events",
    logicalId: "SaveRawEventsFunction",
    handler: "save-raw-events.handler",
    trigger: "sqs",
    status: "verified",
    env: { TABLE_NAME: TABLES.rawEvents, NODE_OPTIONS },
  },
  {
    name: "write-user-services",
    logicalId: "WriteUserServicesFunction",
    handler: "write-user-services.handler",
    trigger: "sqs",
    status: "verified",
    env: { TABLE_NAME: TABLES.userServices, NODE_OPTIONS },
  },
  {
    name: "write-activity-log",
    logicalId: "WriteActivityLogFunction",
    handler: "write-activity-log.handler",
    trigger: "sqs",
    status: "verified",
    env: {
      TABLE_NAME: TABLES.activityLog,
      GENERATOR_KEY_ARN: { key: "generator" },
      WRAPPING_KEY_ARN: { key: "wrapper" },
      BACKUP_WRAPPING_KEY_ARN: { key: "backupWrapper" },
      VERIFY_ACCESS_VALUE: "local-verify-access-value",
      ACCOUNT_ID: "000000000000",
      ENVIRONMENT: LOCAL_ENVIRONMENT,
      NODE_OPTIONS,
    },
  },
  {
    name: "update-inactive-account-tracker",
    logicalId: "UpdateInactiveAccountTrackerFunction",
    handler: "update-inactive-account-tracker.handler",
    trigger: "dynamodb-stream",
    status: "verified",
    notes:
      "Uses TransactWriteItems, which the compatibility check could not verify; `local:verify` checks it directly.",
    env: {
      NODE_OPTIONS,
      INACTIVE_ACCOUNT_TRACKER_TABLE_NAME: TABLES.tracker,
      USER_NOTIFICATIONS_TABLE_NAME: TABLES.userNotifications,
      OLH_CLIENT_ID: "oneLoginHome",
      AUTH_BACKFILL_COMPLETE_DATETIME: "",
      GOV_UK_APP_CLIENT_ID: "govukApp",
      NOTIFICATION_QUEUE_URL: { queue: "NotificationQueue" },
      NOTIFY_TEMPLATE_IDS,
      SEND_INACTIVE_ACCOUNT_DELETION_EMAILS: "0",
      TXMA_QUEUE_URL: { queue: "AuditOutputQueue" },
    },
  },

  // -------------------------------------------------------------- unverified
  {
    name: "update-inactive-account-tracker-backfill-replay",
    logicalId: "UpdateInactiveAccountTrackerForBackillReplayFunction",
    handler: "update-inactive-account-tracker.handler",
    trigger: "sqs",
    status: "unverified",
    notes: "Same handler as update-inactive-account-tracker, fed from SQS.",
    env: {
      NODE_OPTIONS,
      INACTIVE_ACCOUNT_TRACKER_TABLE_NAME: TABLES.tracker,
      USER_NOTIFICATIONS_TABLE_NAME: TABLES.userNotifications,
      OLH_CLIENT_ID: "oneLoginHome",
      AUTH_BACKFILL_COMPLETE_DATETIME: "",
      GOV_UK_APP_CLIENT_ID: "govukApp",
      NOTIFICATION_QUEUE_URL: { queue: "NotificationQueue" },
      NOTIFY_TEMPLATE_IDS,
      SEND_INACTIVE_ACCOUNT_DELETION_EMAILS: "0",
      TXMA_QUEUE_URL: { queue: "AuditOutputQueue" },
    },
  },
  {
    name: "query-user-services",
    logicalId: "QueryUserServicesFunction",
    handler: "query-user-services.handler",
    trigger: "dynamodb-stream",
    status: "unverified",
    notes: "Not covered by `local:verify`.",
    env: {
      TABLE_NAME: TABLES.userServices,
      OUTPUT_QUEUE_URL: { queue: "UserServicesToFormatQueue" },
      NODE_OPTIONS,
    },
  },
  {
    name: "format-user-services",
    logicalId: "FormatUserServicesFunction",
    handler: "format-user-services.handler",
    trigger: "sqs",
    status: "unverified",
    notes: "Not covered by `local:verify`.",
    env: {
      OUTPUT_QUEUE_URL: { queue: "UserServicesToWriteQueue" },
      NODE_OPTIONS,
      ENVIRONMENT: LOCAL_ENVIRONMENT,
    },
  },
  {
    name: "delete-user-services",
    logicalId: "DeleteUserServicesFunction",
    handler: "delete-user-services.handler",
    trigger: "sqs",
    status: "unverified",
    notes: "Not covered by `local:verify`.",
    env: { TABLE_NAME: TABLES.userServices, NODE_OPTIONS },
  },
  {
    name: "delete-email-subscriptions",
    logicalId: "DeleteEmailSubscriptionsFunction",
    handler: "delete-email-subscriptions.handler",
    trigger: "sqs",
    status: "unverified",
    notes: "Calls the GOV.UK publishing API, which has no local equivalent.",
    env: {
      GOV_ACCOUNTS_PUBLISHING_API_TOKEN: UNAVAILABLE,
      GOV_ACCOUNTS_PUBLISHING_API_URL: "http://127.0.0.1:1",
      FEATURE_DELETE_EMAIL_SUBSCRIPTIONS: "false",
      NODE_OPTIONS,
    },
  },
  {
    name: "format-activity-log",
    logicalId: "FormatActivityLogFunction",
    handler: "format-activity-log.handler",
    trigger: "dynamodb-stream",
    status: "unverified",
    notes: "Not covered by `local:verify`.",
    env: {
      OUTPUT_QUEUE_URL: { queue: "ActivityLogToWriteQueue" },
      ENVIRONMENT: LOCAL_ENVIRONMENT,
      ACCOUNT_ID: "000000000000",
      GENERATOR_KEY_ARN: { key: "generator" },
      WRAPPING_KEY_ARN: { key: "wrapper" },
      NODE_OPTIONS,
    },
  },
  {
    name: "update-user-email",
    logicalId: "UpdateUserEmailFunction",
    handler: "update-user-email.handler",
    trigger: "dynamodb-stream",
    status: "unverified",
    notes: TRANSACT_NOTE,
    env: {
      NODE_OPTIONS,
      INACTIVE_ACCOUNT_TRACKER_TABLE_NAME: TABLES.tracker,
    },
  },
  {
    name: "publish-account-deletion",
    logicalId: "PublishAccountDeletionFunction",
    handler: "publish-account-deletion.handler",
    trigger: "dynamodb-stream",
    status: "unverified",
    notes: SNS_NOTE,
    env: {
      TOPIC_ARN: `arn:aws:sns:eu-west-2:000000000000:${UNAVAILABLE}`,
      NODE_OPTIONS,
    },
  },
  {
    name: "delete-activity-log",
    logicalId: "DeleteActivityLogFunction",
    handler: "delete-activity-log.handler",
    trigger: "sqs",
    status: "unverified",
    notes: "Not covered by `local:verify`.",
    env: { TABLE_NAME: TABLES.activityLog, NODE_OPTIONS },
  },
  {
    name: "delete-user-notifications",
    logicalId: "DeleteUserNotificationsFunction",
    handler: "delete-user-notifications.handler",
    trigger: "sqs",
    status: "unverified",
    notes: "Not covered by `local:verify`.",
    env: { TABLE_NAME: TABLES.userNotifications, NODE_OPTIONS },
  },
  {
    name: "delete-inactive-account-tracker",
    logicalId: "DeleteInactiveAccountTrackerFunction",
    handler: "delete-inactive-account-tracker.handler",
    trigger: "sqs",
    status: "unverified",
    notes:
      "Calls the Account Interventions Service API, which has no local equivalent.",
    env: {
      TABLE_NAME: TABLES.tracker,
      NODE_OPTIONS,
      TXMA_QUEUE_URL: { queue: "AuditOutputQueue" },
      NOTIFICATION_QUEUE_URL: { queue: "NotificationQueue" },
      ACCOUNT_INTERVENTIONS_SERVICE_API_URL: "http://127.0.0.1:1",
    },
  },
  {
    name: "mark-activity-reported",
    logicalId: "MarkActivityReportedFunction",
    handler: "mark-activity-reported.handler",
    trigger: "step-function",
    status: "unverified",
    notes: "Conditional UpdateItem is not covered by the compatibility check.",
    env: {
      ACTIVITY_LOG_TABLE_NAME: TABLES.activityLog,
      GENERATOR_KEY_ARN: { key: "generator" },
      WRAPPING_KEY_ARN: { key: "wrapper" },
      VERIFY_ACCESS_VALUE: "local-verify-access-value",
      ACCOUNT_ID: "000000000000",
      ENVIRONMENT: LOCAL_ENVIRONMENT,
      NODE_OPTIONS,
    },
  },
  {
    name: "send-suspicious-activity",
    logicalId: "SendSuspiciousActivityFunction",
    handler: "send-suspicious-activity.handler",
    trigger: "step-function",
    status: "unverified",
    notes: "Not covered by `local:verify`.",
    env: {
      EVENT_NAME: "HOME_REPORT_SUSPICIOUS_ACTIVITY",
      TXMA_QUEUE_URL: { queue: "AuditOutputQueue" },
      NODE_OPTIONS,
    },
  },
  {
    name: "send-conf-email",
    logicalId: "SendConfEmailFunction",
    handler: "send-conf-email.handler",
    trigger: "step-function",
    status: "unverified",
    notes: NOTIFY_NOTE,
    env: {
      NOTIFY_API_KEY_SECRET_ARN: UNAVAILABLE,
      TEMPLATE_ID: "local-template-id",
      ENVIRONMENT_NAME: LOCAL_ENVIRONMENT,
      NODE_OPTIONS,
    },
  },
  {
    name: "create-support-ticket",
    logicalId: "CreateSupportTicketFunction",
    handler: "create-support-ticket.handler",
    trigger: "step-function",
    status: "unverified",
    notes:
      "Calls Zendesk and reads SSM parameters, which have no local equivalent.",
    env: {
      ZENDESK_GROUP_ID_KEY: UNAVAILABLE,
      ZENDESK_TAGS_KEY: UNAVAILABLE,
      ZENDESK_API_TOKEN_KEY: UNAVAILABLE,
      ZENDESK_API_USER_KEY: UNAVAILABLE,
      ZENDESK_API_URL_KEY: UNAVAILABLE,
      ZENDESK_TICKET_FORM_ID: UNAVAILABLE,
      ACTIVITY_LOG_TABLE: TABLES.activityLog,
      NODE_OPTIONS,
    },
  },
  {
    name: "trigger-rsa-step",
    logicalId: "TriggerSuspiciousActivityStepFunction",
    handler: "trigger-rsa-step.handler",
    trigger: "api-gateway",
    status: "unverified",
    notes: SFN_NOTE,
    env: {
      STATE_MACHINE_ARN: `arn:aws:states:eu-west-2:000000000000:stateMachine:${UNAVAILABLE}`,
      STEP_FUNCTION_ALIAS: "latest",
      NODE_OPTIONS,
    },
  },
  {
    name: "notification-service",
    logicalId: "NotificationServiceFunction",
    handler: "notification-service.handler",
    trigger: "sqs",
    status: "unverified",
    notes: NOTIFY_NOTE,
    env: {
      NODE_OPTIONS,
      NOTIFY_API_KEY_SECRET_ARN: UNAVAILABLE,
      NOTIFY_TEMPLATE_IDS,
      NOTIFY_DONT_SEND_EMAILS_TO: "",
      INTEGRATION_TEST_STUB_API_URL: "",
    },
  },
  {
    name: "analyse-activity-log",
    logicalId: "AnalyseActivityLogFunction",
    handler: "analyse-activity-log/handler.handler",
    trigger: "invoke",
    status: "unverified",
    notes: "Not covered by `local:verify`.",
    env: { NODE_OPTIONS, TABLE_NAME: TABLES.activityLog },
  },
  {
    name: "analyse-tracker-integrity",
    logicalId: "AnalyseTrackerIntegrityFunction",
    handler: "analyse-tracker-integrity/handler.handler",
    trigger: "invoke",
    status: "unverified",
    notes: "Not covered by `local:verify`.",
    env: { NODE_OPTIONS, TABLE_NAME: TABLES.tracker },
  },
  {
    name: "query-and-dispatch-inactive-accounts",
    logicalId: "QueryAndDispatchInactiveAccountsFunction",
    handler: "query-and-dispatch-inactive-accounts.handler",
    trigger: "schedule",
    status: "unverified",
    notes: "Not covered by `local:verify`.",
    env: {
      TABLE_NAME: TABLES.tracker,
      FORECAST_TABLE_NAME: TABLES.forecast,
      WARNING_30_DAY_NOTIFICATION_QUEUE_URL: {
        queue: "30DayNotificationQueue",
      },
      WARNING_7_DAY_NOTIFICATION_QUEUE_URL: { queue: "7DayNotificationQueue" },
      ACCOUNT_DELETION_QUEUE_URL: { queue: "AccountDeletionProcessQueue" },
      NODE_OPTIONS,
      INACTIVE_ACCOUNT_CIRCUIT_BREAKER_TABLE_NAME: TABLES.circuitBreaker,
    },
  },
  {
    name: "process-inactive-account",
    logicalId: "ProcessInactiveAccountFunction",
    handler: "process-inactive-account.handler",
    trigger: "sqs",
    status: "unverified",
    notes:
      "Uses TransactWriteItems and calls the Account Interventions Service API, which has no local equivalent.",
    env: {
      NODE_OPTIONS,
      NOTIFICATION_QUEUE_URL: { queue: "NotificationQueue" },
      INACTIVE_ACCOUNT_TRACKER_TABLE_NAME: TABLES.tracker,
      ACCOUNT_DELETION_QUEUE_URL: { queue: "AccountDeletionQueue" },
      ACTIVITY_LOG_TABLE_NAME: TABLES.activityLog,
      INACTIVE_ACCOUNT_CIRCUIT_BREAKER_TABLE_NAME: TABLES.circuitBreaker,
      TXMA_QUEUE_URL: { queue: "AuditOutputQueue" },
      ACCOUNT_INTERVENTIONS_SERVICE_API_URL: "http://127.0.0.1:1",
      SEND_INACTIVE_ACCOUNT_DELETION_EMAILS: "0",
      USER_NOTIFICATIONS_TABLE_NAME: TABLES.userNotifications,
    },
  },
  {
    name: "inactive-account-deletion-forecast",
    logicalId: "InactiveAccountDeletionForecastFunction",
    handler: "inactive-account-deletion-forecast.handler",
    trigger: "schedule",
    status: "unverified",
    notes: "Not covered by `local:verify`.",
    env: {
      TABLE_NAME: TABLES.tracker,
      FORECAST_TABLE_NAME: TABLES.forecast,
      NODE_OPTIONS,
    },
  },
  {
    name: "notify-delivery-receipts",
    logicalId: "NotifyDeliveryReceiptsLambda",
    handler: "notify-delivery-receipts.handler",
    trigger: "api-gateway",
    status: "unverified",
    notes: "Reads the Notify callback secret, which has no local equivalent.",
    env: {
      NOTIFY_DELIVERY_RECEIPTS_SECRET_ARN: UNAVAILABLE,
      INACTIVE_ACCOUNT_TRACKER_TABLE_NAME: TABLES.tracker,
      TXMA_QUEUE_URL: { queue: "AuditOutputQueue" },
    },
  },
  {
    name: "integration-test-stub-api",
    logicalId: "IntegrationTestStubApiLambda",
    handler: "integration-test-stub-api-handler.handler",
    trigger: "api-gateway",
    status: "unverified",
    notes: "Not covered by `local:verify`.",
    env: {
      INTEGRATION_TEST_STUB_API_OUTPUTS_TABLE_NAME: TABLES.stubOutputs,
      INTEGRATION_TEST_STUB_API_OUTPUTS_ALL_ITEMS_INDEX_NAME: "AllItemsIndex",
    },
  },
  {
    name: "replay-raw-events-backfill",
    logicalId: "ReplayRawEventsBackfillFunction",
    handler: "replay-raw-events-backfill.handler",
    trigger: "invoke",
    status: "unverified",
    notes:
      "Needs the backfill and checkpoint tables, which bootstrap does not create.",
    env: {
      NODE_OPTIONS,
      BACKFILL_TABLE_NAME: "raw_events_restored_iad_dpt_backfill",
      BACKFILL_QUEUE_URL: { queue: "RawEventsBackfillQueue" },
      CHECKPOINT_TABLE_NAME: "replay_raw_events_backfill_checkpoint",
      TOTAL_SEGMENTS: "100",
    },
  },
];

export const findFunction = (name: string): LocalFunction | undefined =>
  FUNCTIONS.find((fn) => fn.name === name);
