import type {
  InactiveAccountStatus,
  InactiveAccountTrackerRecord,
} from "./model.js";
import { hasRecentActivityLogEntry } from "./iadGuards/hasRecentActivityLogEntry.js";
import { hasAisBlockIntervention } from "./iadGuards/hasAisBlockIntervention.js";
import { hasUndeliverableEmailAddress } from "./iadGuards/hasUndeliverableEmailAddress.js";
import { sendInactiveAccountEmailsIsDisabled } from "./iadGuards/sendInactiveAccountEmailsIsDisabled.js";
import { dateForDeletionIs27October } from "./iadGuards/dateForDeletionIs27October.js";
import { doesNotHaveEmailAddress } from "./iadGuards/doesNotHaveEmailAddress.js";
import { hasNotSetupMfa } from "./iadGuards/hasNotSetupMfa.js";
import { homeAccountTrackerNotificationSkippedReasons } from "./notification-configuration.js";
export type Guard = (trackerRecord: InactiveAccountTrackerRecord) => Promise<{
  guardActivated: boolean;
  guardName: string;
}>;

interface ProcessGuard {
  guard: Guard;
  isCritical: boolean;
  skippedNotificationAuditEventName?: string;
  skippedNotificationAuditEventReason?: string;
}

export type ProcessConfig = Record<
  string,
  {
    queueUrlEnvVar: string;
    daysToDeletion: number[];
    allowedStatuses: InactiveAccountStatus[];
    targetStatus?: InactiveAccountStatus;
    notificationType?: string;
    targetQueueUrlEnvVar?: string;
    auditEventName?: string;
    sendAdditionalAuditEventDetails?: boolean;
    isDryRun?: boolean;
    guards?: {
      abort?: ProcessGuard[];
      continueWithoutActions?: ProcessGuard[];
    };
  }
>;

const warningsAbortGuardsList: ProcessGuard[] = [
  {
    guard: doesNotHaveEmailAddress,
    isCritical: true,
  },
];

const warningsContinueWithoutActionsGuardsList: ProcessGuard[] = [
  {
    guard: sendInactiveAccountEmailsIsDisabled,
    isCritical: false,
  },
  {
    guard: dateForDeletionIs27October,
    isCritical: false,
    skippedNotificationAuditEventReason:
      homeAccountTrackerNotificationSkippedReasons.isLikelyVerify,
    skippedNotificationAuditEventName:
      "HOME_ACCOUNT_TRACKER_NOTIFICATION_SKIPPED",
  },
  {
    guard: hasNotSetupMfa,
    isCritical: false,
    skippedNotificationAuditEventReason:
      homeAccountTrackerNotificationSkippedReasons.unusable,
    skippedNotificationAuditEventName:
      "HOME_ACCOUNT_TRACKER_NOTIFICATION_SKIPPED",
  },
  {
    guard: hasUndeliverableEmailAddress,
    isCritical: false,
    skippedNotificationAuditEventReason:
      homeAccountTrackerNotificationSkippedReasons.undeliverable,
    skippedNotificationAuditEventName:
      "HOME_ACCOUNT_TRACKER_NOTIFICATION_SKIPPED",
  },
  {
    guard: hasAisBlockIntervention,
    isCritical: false,
    skippedNotificationAuditEventReason:
      homeAccountTrackerNotificationSkippedReasons.suspended,
    skippedNotificationAuditEventName:
      "HOME_ACCOUNT_TRACKER_NOTIFICATION_SKIPPED",
  },
];

export const processConfig: ProcessConfig = {
  Warning30Day: {
    queueUrlEnvVar: "WARNING_30_DAY_NOTIFICATION_QUEUE_URL",
    daysToDeletion: [30],
    allowedStatuses: ["pending"],
    targetStatus: "30DayWarningSent",
    notificationType: "INACTIVE_ACCOUNT_WARNING_30_DAY",
    auditEventName: "HOME_ACCOUNT_TRACKER_ACCOUNT_FIRST_PERIOD_ENTERED",
    guards: {
      abort: warningsAbortGuardsList,
      continueWithoutActions: warningsContinueWithoutActionsGuardsList,
    },
  },
  Warning7Day: {
    queueUrlEnvVar: "WARNING_7_DAY_NOTIFICATION_QUEUE_URL",
    daysToDeletion: [7],
    allowedStatuses: ["pending", "30DayWarningSent"],
    targetStatus: "7DayWarningSent",
    notificationType: "INACTIVE_ACCOUNT_WARNING_7_DAY",
    auditEventName: "HOME_ACCOUNT_TRACKER_ACCOUNT_SECOND_PERIOD_ENTERED",
    guards: {
      abort: warningsAbortGuardsList,
      continueWithoutActions: warningsContinueWithoutActionsGuardsList,
    },
  },
  DeleteAccount: {
    queueUrlEnvVar: "ACCOUNT_DELETION_QUEUE_URL",
    daysToDeletion: [
      0, -1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11, -12, -13, -14,
    ],
    allowedStatuses: ["pending", "30DayWarningSent", "7DayWarningSent"],
    targetStatus: "deleting",
    targetQueueUrlEnvVar: "ACCOUNT_DELETION_QUEUE_URL",
    auditEventName: "HOME_ACCOUNT_TRACKER_ACCOUNT_DELETION_REQUESTED",
    sendAdditionalAuditEventDetails: true,
    guards: {
      abort: [
        {
          guard: doesNotHaveEmailAddress,
          isCritical: true,
        },
        {
          guard: hasRecentActivityLogEntry,
          isCritical: true,
        },
      ],
    },
  },
  DeletionDryRun: {
    queueUrlEnvVar: "ACCOUNT_DELETION_QUEUE_URL",
    daysToDeletion: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    allowedStatuses: ["pending", "30DayWarningSent", "7DayWarningSent"],
    isDryRun: true,
  },
};
