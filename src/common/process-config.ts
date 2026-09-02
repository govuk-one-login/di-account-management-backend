import type { InactiveAccountStatus } from "./model.js";
import { hasRecentActivityLogEntry } from "./iadGuards/hasRecentActivityLogEntry.js";
import { hasAisBlockIntervention } from "./iadGuards/hasAisBlockIntervention.js";
import { hasUndeliverableEmailAddress } from "./iadGuards/hasUndeliverableEmailAddress.js";
import { sendInactiveAccountEmailsIsEnabled } from "./iadGuards/sendInactiveAccountEmailsIsEnabled.js";
import { hasEmailAddress } from "./iadGuards/hasEmailAddress.js";

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
  },
  hasRecentActivityLogEntry: {
    guard: hasRecentActivityLogEntry,
    contributeToAlarm: true,
  },
  hasUndeliverableEmailAddress: {
    guard: hasUndeliverableEmailAddress,
    contributeToAlarm: false,
  },
  sendInactiveAccountEmailsIsEnabled: {
    guard: sendInactiveAccountEmailsIsEnabled,
    contributeToAlarm: false,
  },
  hasEmailAddress: {
    guard: hasEmailAddress,
    contributeToAlarm: true,
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
    guards?: {
      guard: Guard;
      contributeToAlarm: boolean;
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
    ],
  },
  DeleteAccount: {
    queueUrlEnvVar: "ACCOUNT_DELETION_QUEUE_URL",
    daysToDeletion: [0],
    allowedStatuses: ["pending", "30DayWarningSent", "7DayWarningSent"],
    targetStatus: "deleting",
    targetQueueUrlEnvVar: "ACCOUNT_DELETION_QUEUE_URL",
    guards: [
      guardsList.hasEmailAddress,
      guardsList.hasAisBlockIntervention,
      guardsList.hasRecentActivityLogEntry,
    ],
  },
};
