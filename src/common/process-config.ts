import type { InactiveAccountStatus } from "./model.js";
import { hasRecentActivityLogEntry } from "./iadGuards/hasRecentActivityLogEntry.js";
import { hasAisBlockIntervention } from "./iadGuards/hasAisBlockIntervention.js";
import { hasUndeliverableEmailAddress } from "./iadGuards/hasUndeliverableEmailAddress.js";
import { sendInactiveAccountEmailsIsDisabled } from "./iadGuards/sendInactiveAccountEmailsIsDisabled.js";
import { dateForDeletionIs27October } from "./iadGuards/dateForDeletionIs27October.js";
import { doesNotHaveEmailAddress } from "./iadGuards/doesNotHaveEmailAddress.js";
import { hasNotSetupMfa } from "./iadGuards/hasNotSetupMfa.js";

export enum Actions {
  continue = "Continue",
  abort = "Abort",
  continueWithoutActions = "ContinueWithoutPerformingActions",
}

export type Guard = (
  commonSubjectId?: string,
  emailAddress?: string,
  dateForDeletion?: string
) => Promise<{
  continue: Actions;
  guardName: string;
}>;

const guardsList = {
  hasAisBlockIntervention: {
    guard: hasAisBlockIntervention,
    contributeToAlarm: false,
    skippedNotificationAuditEventReason: "IndefiniteSuspension",
    skippedNotificationAuditEventName:
      "HOME_ACCOUNT_TRACKER_NOTIFICATION_SKIPPED",
  },
  hasRecentActivityLogEntry: {
    guard: hasRecentActivityLogEntry,
    contributeToAlarm: true,
  },
  hasUndeliverableEmailAddress: {
    guard: hasUndeliverableEmailAddress,
    contributeToAlarm: false,
    skippedNotificationAuditEventReason: "PreviouslyUndeliverable",
    skippedNotificationAuditEventName:
      "HOME_ACCOUNT_TRACKER_NOTIFICATION_SKIPPED",
  },
  sendInactiveAccountEmailsIsDisabled: {
    guard: sendInactiveAccountEmailsIsDisabled,
    contributeToAlarm: false,
  },
  doesNotHaveEmailAddress: {
    guard: doesNotHaveEmailAddress,
    contributeToAlarm: true,
  },
  hasNotSetupMfa: {
    guard: hasNotSetupMfa,
    contributeToAlarm: false,
    skippedNotificationAuditEventReason: "UnusableAccount",
    skippedNotificationAuditEventName:
      "HOME_ACCOUNT_TRACKER_NOTIFICATION_SKIPPED",
  },
  dateForDeletionIs27October: {
    guard: dateForDeletionIs27October,
    contributeToAlarm: false,
    skippedNotificationAuditEventReason: "LikelyVerifyMigratedUser",
    skippedNotificationAuditEventName:
      "HOME_ACCOUNT_TRACKER_NOTIFICATION_SKIPPED",
  },
};

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
      guard: Guard;
      contributeToAlarm: boolean;
      skippedNotificationAuditEventName?: string;
      skippedNotificationAuditEventReason?: string;
    }[];
  }
>;

export const processConfig: ProcessConfig = {
  Warning30Day: {
    queueUrlEnvVar: "WARNING_30_DAY_NOTIFICATION_QUEUE_URL",
    daysToDeletion: [30],
    allowedStatuses: ["pending"],
    targetStatus: "30DayWarningSent",
    notificationType: "INACTIVE_ACCOUNT_WARNING_30_DAY",
    auditEventName: "HOME_ACCOUNT_TRACKER_ACCOUNT_FIRST_PERIOD_ENTERED",
    guards: [
      guardsList.sendInactiveAccountEmailsIsDisabled,
      guardsList.doesNotHaveEmailAddress,
      guardsList.hasAisBlockIntervention,
      guardsList.hasUndeliverableEmailAddress,
      guardsList.hasNotSetupMfa,
      guardsList.dateForDeletionIs27October,
    ],
  },
  Warning7Day: {
    queueUrlEnvVar: "WARNING_7_DAY_NOTIFICATION_QUEUE_URL",
    daysToDeletion: [7],
    allowedStatuses: ["pending", "30DayWarningSent"],
    targetStatus: "7DayWarningSent",
    notificationType: "INACTIVE_ACCOUNT_WARNING_7_DAY",
    auditEventName: "HOME_ACCOUNT_TRACKER_ACCOUNT_SECOND_PERIOD_ENTERED",
    guards: [
      guardsList.sendInactiveAccountEmailsIsDisabled,
      guardsList.doesNotHaveEmailAddress,
      guardsList.hasAisBlockIntervention,
      guardsList.hasUndeliverableEmailAddress,
      guardsList.hasNotSetupMfa,
      guardsList.dateForDeletionIs27October,
    ],
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
    guards: [
      guardsList.doesNotHaveEmailAddress,
      guardsList.hasRecentActivityLogEntry,
    ],
  },
  DeletionDryRun: {
    queueUrlEnvVar: "ACCOUNT_DELETION_QUEUE_URL",
    daysToDeletion: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    allowedStatuses: ["pending", "30DayWarningSent", "7DayWarningSent"],
    isDryRun: true,
  },
};
