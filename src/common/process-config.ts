import type { InactiveAccountStatus } from "./model.js";

export type ProcessConfig = Record<string, { queueUrlEnvVar: string; daysToDeletion: number[]; allowedStatuses: InactiveAccountStatus[] }>;

export const processConfig: ProcessConfig = {
  Warning30Day: { queueUrlEnvVar: "WARNING_30_DAY_NOTIFICATION_QUEUE_URL", daysToDeletion: [30], allowedStatuses: ["pending"] },
  Warning7Day: { queueUrlEnvVar: "WARNING_7_DAY_NOTIFICATION_QUEUE_URL", daysToDeletion: [7], allowedStatuses: ["pending", "30DayWarningSent"] },
  DeleteAccount: { queueUrlEnvVar: "ACCOUNT_DELETION_QUEUE_URL", daysToDeletion: [0], allowedStatuses: ["pending", "30DayWarningSent", "7DayWarningSent"] },
};
