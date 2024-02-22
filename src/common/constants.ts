export const COMPONENT_ID = "https://home.account.gov.uk";

export enum EventNamesEnum {
  HOME_REPORT_SUSPICIOUS_ACTIVITY = "HOME_REPORT_SUSPICIOUS_ACTIVITY",
}

export enum ValidationRulesKeyEnum {
  HOME_REPORT_SUSPICIOUS_ACTIVITY = "HOME_REPORT_SUSPICIOUS_ACTIVITY",
  TXMA_EVENT = "TXMA_EVENT",
  reported_event = "reported_event",
  activities = "activities",
  user = "user",
  extensions = "extensions",
}

export const allowedTxmaEvents: Array<string> = [
  "AUTH_AUTH_CODE_ISSUED",
  "AUTH_IPV_AUTHORISATION_REQUESTED",
  "AUTH_IPV_SUCCESSFUL_IDENTITY_RESPONSE_RECEIVED",
];

export const REPORT_SUSPICIOUS_ACTIVITY_DEFAULT = false;
export const CREATE_TICKET_PATH = "/tickets.json";
export const SUSPICIOUS_ACTIVITY_EVENT_NAME = "HOME_REPORT_SUSPICIOUS_ACTIVITY";
