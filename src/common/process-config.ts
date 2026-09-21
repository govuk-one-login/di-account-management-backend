import type { InactiveAccountStatus } from "./model.js";
import { hasRecentActivityLogEntry } from "./iadGuards/processGuards/hasRecentActivityLogEntry.js";
import { hasAisBlockIntervention } from "./iadGuards/processGuards/hasAisBlockIntervention.js";
import { hasUndeliverableEmailAddress } from "./iadGuards/processGuards/hasUndeliverableEmailAddress.js";
import { sendInactiveAccountEmailsIsDisabled } from "./iadGuards/processGuards/sendInactiveAccountEmailsIsDisabled.js";
import { dateForDeletionIs27October } from "./iadGuards/processGuards/dateForDeletionIs27October.js";
import { doesNotHaveEmailAddress } from "./iadGuards/processGuards/doesNotHaveEmailAddress.js";
import { hasNotSetupMfa } from "./iadGuards/processGuards/hasNotSetupMfa.js";

export type Guard = (
  commonSubjectId?: string,
  emailAddress?: string,
  dateForDeletion?: string
) => Promise<{
  guardActivated: boolean;
  guardName: string;
}>;

interface ProcessGuard {
  guard: Guard;
  contributeToAlarm: boolean;
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
    contributeToAlarm: true,
  },
];

const warningsContinueWithoutActionsGuardsList: ProcessGuard[] = [
  {
    guard: sendInactiveAccountEmailsIsDisabled,
    contributeToAlarm: false,
  },
  {
    guard: dateForDeletionIs27October,
    contributeToAlarm: false,
    skippedNotificationAuditEventReason: "LikelyVerifyMigratedUser",
    skippedNotificationAuditEventName:
      "HOME_ACCOUNT_TRACKER_NOTIFICATION_SKIPPED",
  },
  {
    guard: hasNotSetupMfa,
    contributeToAlarm: false,
    skippedNotificationAuditEventReason: "UnusableAccount",
    skippedNotificationAuditEventName:
      "HOME_ACCOUNT_TRACKER_NOTIFICATION_SKIPPED",
  },
  {
    guard: hasUndeliverableEmailAddress,
    contributeToAlarm: false,
    skippedNotificationAuditEventReason: "PreviouslyUndeliverable",
    skippedNotificationAuditEventName:
      "HOME_ACCOUNT_TRACKER_NOTIFICATION_SKIPPED",
  },
  {
    guard: hasAisBlockIntervention,
    contributeToAlarm: false,
    skippedNotificationAuditEventReason: "IndefiniteSuspension",
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
          contributeToAlarm: true,
        },
        {
          guard: hasRecentActivityLogEntry,
          contributeToAlarm: true,
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
