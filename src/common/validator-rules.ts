import { ValidationRulesKeyEnum } from "./constants";

export interface ValidationRule {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  (value: any): boolean;
}

export interface ValidationRules {
  [key: string]: ValidationRule[] | ValidationRules;
}

const VALIDATOR_RULES_MAP = new Map<string, ValidationRules>();

VALIDATOR_RULES_MAP.set(
  ValidationRulesKeyEnum.HOME_REPORT_SUSPICIOUS_ACTIVITY,
  {
    event_id: [(value) => typeof value === "string" && value.length > 0],
    email_address: [(value) => typeof value === "string" && value.length > 0],
    zendesk_ticket_id: [
      (value) => typeof value === "string" && value.length > 0,
    ],
    notify_message_id: [
      (value) => typeof value === "string" && value.length > 0,
    ],
    event_type: [(value) => typeof value === "string" && value.length > 0],
    timestamp: [(value) => typeof value === "number"],
    event_timestamp_ms: [(value) => typeof value === "number"],
    event_timestamp_ms_formatted: [
      (value) => typeof value === "string" && value.length > 0,
    ],
  }
);

VALIDATOR_RULES_MAP.set(ValidationRulesKeyEnum.TXMA_EVENT, {
  user: {
    user_id: [(value) => typeof value === "string" && value.length > 0],
    persistent_session_id: [
      (value) => typeof value === "string" && value.length > 0,
    ],
    session_id: [(value) => typeof value === "string" && value.length > 0],
  },
  component_id: [(value) => typeof value === "string" && value.length > 0],
  event_name: [(value) => typeof value === "string" && value.length > 0],
  timestamp: [(value) => typeof value === "number"],
  event_timestamp_ms: [(value) => typeof value === "number"],
  event_timestamp_ms_formatted: [
    (value) => typeof value === "string" && value.length > 0,
  ],
});

export default VALIDATOR_RULES_MAP;
