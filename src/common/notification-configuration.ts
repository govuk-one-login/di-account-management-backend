import { IadEvent } from "./send-audit-event.js";

export type NotificationConfig = Record<
  string,
  {
    name: string;
    auditEvent?: IadEvent;
    auditEventNotificationType?: string;
  }
>;

export const notificationConfiguration: NotificationConfig = {
  GLOBAL_LOGOUT: {
    name: "GLOBAL_LOGOUT",
  },
  INACTIVE_ACCOUNT_WARNING_30_DAY: {
    name: "INACTIVE_ACCOUNT_WARNING_30_DAY",
    auditEvent: "HOME_ACCOUNT_TRACKER_NOTIFICATION_REQUESTED",
    auditEventNotificationType: "30DayWarning",
  },
  INACTIVE_ACCOUNT_WARNING_7_DAY: {
    name: "INACTIVE_ACCOUNT_WARNING_7_DAY",
    auditEvent: "HOME_ACCOUNT_TRACKER_NOTIFICATION_REQUESTED",
    auditEventNotificationType: "7DayWarning",
  },
  INACTIVE_ACCOUNT_SAVED_APP: {
    name: "INACTIVE_ACCOUNT_SAVED_APP",
    auditEvent: "HOME_ACCOUNT_TRACKER_NOTIFICATION_REQUESTED",
    auditEventNotificationType: "RecoveryViaApp",
  },
  INACTIVE_ACCOUNT_SAVED_HOME: {
    name: "INACTIVE_ACCOUNT_SAVED_HOME",
    auditEvent: "HOME_ACCOUNT_TRACKER_NOTIFICATION_REQUESTED",
    auditEventNotificationType: "RecoveryViaHome",
  },
  INACTIVE_ACCOUNT_SAVED_RP: {
    name: "INACTIVE_ACCOUNT_SAVED_RP",
    auditEvent: "HOME_ACCOUNT_TRACKER_NOTIFICATION_REQUESTED",
    auditEventNotificationType: "Recovery",
  },
  INACTIVE_ACCOUNT_DELETED_CONFIRMATION: {
    name: "INACTIVE_ACCOUNT_DELETED_CONFIRMATION",
    auditEvent: "HOME_ACCOUNT_TRACKER_NOTIFICATION_REQUESTED",
    auditEventNotificationType: "Deletion",
  },
};
