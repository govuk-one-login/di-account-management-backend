import type { InactiveAccountStatus } from "./model.js";

export type ProcessConfig = Record<string, {
  queueUrlEnvVar: string;
  daysToDeletion: number[];
  allowedStatuses: InactiveAccountStatus[],
  notificationType?: string
}>;

export const processConfig: ProcessConfig = {
  Warning30Day: {
    queueUrlEnvVar: "WARNING_30_DAY_NOTIFICATION_QUEUE_URL",
    daysToDeletion: [30],
    allowedStatuses: ["pending"],
    notificationType: "INACTIVE_ACCOUNT_WARNING_30_DAY"
  },
  Warning7Day: {
    queueUrlEnvVar: "WARNING_7_DAY_NOTIFICATION_QUEUE_URL",
    daysToDeletion: [7],
    allowedStatuses: ["pending", "30DayWarningSent"],
    notificationType: "INACTIVE_ACCOUNT_WARNING_7_DAY"
  },
  DeleteAccount: {
    queueUrlEnvVar: "ACCOUNT_DELETION_QUEUE_URL",
    daysToDeletion: [0],
    allowedStatuses: ["pending", "30DayWarningSent", "7DayWarningSent"]
  },
};
