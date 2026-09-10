import type { InactiveAccountStatus } from "./model.js";
import { hasRecentActivityLogEntry } from "./iadGuards/hasRecentActivityLogEntry.js";
import { hasAisBlockIntervention } from "./iadGuards/hasAisBlockIntervention.js";
import { hasUndeliverableEmailAddress } from "./iadGuards/hasUndeliverableEmailAddress.js";
import { sendInactiveAccountEmailsIsEnabled } from "./iadGuards/sendInactiveAccountEmailsIsEnabled.js";
import { hasEmailAddress } from "./iadGuards/hasEmailAddress.js";
import { hasNotSetupMfa } from "./iadGuards/hasNotSetupMfa.js";

export enum Actions {
  continue = "Continue",
  abort = "Abort",
  continueWithoutActions = "ContinueWithoutPerformingActions",
}

export type Guard = (
  commonSubjectId?: string,
  emailAddress?: string
) => Promise<{
  continue: Actions;
  guardName: string;
}>;

const guardsList = {
  hasAisBlockIntervention: {
    guard: hasAisBlockIntervention,
    contributeToAlarm: false,
    skippedNotificationAuditEventReason: "IndefiniteSuspension",
    skippedNotificationAuditEventName: "HOME_ACCOUNT_TRACKER_NOTIFICATION_SKIPPED"
  },
  hasRecentActivityLogEntry: {
    guard: hasRecentActivityLogEntry,
    contributeToAlarm: true,
  },
  hasUndeliverableEmailAddress: {
    guard: hasUndeliverableEmailAddress,
    contributeToAlarm: false,
    skippedNotificationAuditEventReason: "PreviouslyUndeliverable",
    skippedNotificationAuditEventName: "HOME_ACCOUNT_TRACKER_NOTIFICATION_SKIPPED"
  },
  sendInactiveAccountEmailsIsEnabled: {
    guard: sendInactiveAccountEmailsIsEnabled,
    contributeToAlarm: false,
  },
  hasEmailAddress: {
    guard: hasEmailAddress,
    contributeToAlarm: true,
  },
  hasNotSetupMfa: {
    guard: hasNotSetupMfa,
    contributeToAlarm: false,
    skippedNotificationAuditEventReason: "UnusableAccount",
    skippedNotificationAuditEventName: "HOME_ACCOUNT_TRACKER_NOTIFICATION_SKIPPED"
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
      guardsList.sendInactiveAccountEmailsIsEnabled,
      guardsList.hasEmailAddress,
      guardsList.hasAisBlockIntervention,
      guardsList.hasUndeliverableEmailAddress,
      guardsList.hasNotSetupMfa,
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
      guardsList.sendInactiveAccountEmailsIsEnabled,
      guardsList.hasEmailAddress,
      guardsList.hasAisBlockIntervention,
      guardsList.hasUndeliverableEmailAddress,
      guardsList.hasNotSetupMfa,
    ],
  },
  DeleteAccount: {
    queueUrlEnvVar: "ACCOUNT_DELETION_QUEUE_URL",
    daysToDeletion: [0, -1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11, -12, -13, -14],
    allowedStatuses: ["pending", "30DayWarningSent", "7DayWarningSent"],
    targetStatus: "deleting",
    targetQueueUrlEnvVar: "ACCOUNT_DELETION_QUEUE_URL",
    auditEventName: "HOME_ACCOUNT_TRACKER_ACCOUNT_DELETION_REQUESTED",
    sendAdditionalAuditEventDetails: true,
    guards: [
      guardsList.hasEmailAddress,
      guardsList.hasRecentActivityLogEntry,
    ],
  },
};
