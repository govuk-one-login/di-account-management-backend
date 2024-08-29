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

export const allowedTxmaEvents: string[] = [
  "AUTH_AUTH_CODE_ISSUED",
  "AUTH_IPV_AUTHORISATION_REQUESTED",
  "AUTH_IPV_SUCCESSFUL_IDENTITY_RESPONSE_RECEIVED",
];

export const REPORT_SUSPICIOUS_ACTIVITY_DEFAULT = false;
export const CREATE_TICKET_PATH = "/tickets.json";
export const SUSPICIOUS_ACTIVITY_EVENT_NAME = "HOME_REPORT_SUSPICIOUS_ACTIVITY";

export const HOME_CLIENT_ID_TEST = "oneLoginHome";
const HOME_CLIENT_ID_DEV = "Vcer7-iz9BNrdVFG-JVqJ4k2mvw";
const HOME_CLIENT_ID_BUILD = "UJtd0gskJAqo1MR0liyVU1FykG8";
const HOME_CLIENT_ID_STAGING = "EMGmY82k-92QSakDl_9keKDFmZY";
const HOME_CLIENT_ID_INTEGRATION = "Y8xi2wDAaRvWYlEkoExOUZbAPaYyBEhB";
const HOME_CLIENT_ID_PRODUCTION = "KcKmx2g1GH6ersWFvzMi1bhehq4";

export const homeClientIds: string[] = [
  HOME_CLIENT_ID_TEST,
  HOME_CLIENT_ID_DEV,
  HOME_CLIENT_ID_BUILD,
  HOME_CLIENT_ID_STAGING,
  HOME_CLIENT_ID_INTEGRATION,
  HOME_CLIENT_ID_PRODUCTION,
];
