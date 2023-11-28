import { ValidationRulesKeyEnum } from "./constants";

export interface ValidationRule {
  (value: any): boolean;
}

export interface ValidationRules {
  [key: string]: ValidationRule[] | ValidationRules;
}

const VALIDATOR_RULES_MAP = new Map<string, ValidationRules>();

VALIDATOR_RULES_MAP.set(
  ValidationRulesKeyEnum.HOME_REPORT_SUSPICIOUS_ACTIVITY,
  {
    user_id: [(value) => typeof value === "string" && value.length > 0],
    email_address: [(value) => typeof value === "string" && value.length > 0],
    persistent_session_id: [
      (value) => typeof value === "string" && value.length > 0,
    ],
    session_id: [(value) => typeof value === "string" && value.length > 0],
    reported: [(value) => typeof value === "boolean"],
    reported_event: {
      event_type: [
        (value) => typeof value === "string" && value.length > 0,
        (value) => /^[a-zA-Z0-9_]+$/.test(value),
      ],
      session_id: [(value) => typeof value === "string" && value.length > 0],
      user_id: [(value) => typeof value === "string" && value.length > 0],
      timestamp: [(value) => typeof value === "number"],
      activities: {
        type: [(value) => typeof value === "string" && value.length > 0],
        client_id: [(value) => typeof value === "string" && value.length > 0],
        timestamp: [(value) => typeof value === "number"],
        event_id: [(value) => typeof value === "string" && value.length > 0],
      },
    },
  }
);

VALIDATOR_RULES_MAP.set(ValidationRulesKeyEnum.TXMA_EVENT, {
  event_name: [(value) => typeof value === "string" && value.length > 0],
  component_id: [(value) => typeof value === "string" && value.length > 0],
  user: {
    user_id: [(value) => typeof value === "string" && value.length > 0],
    session_id: [(value) => typeof value === "string" && value.length > 0],
    persistent_session_id: [
      (value) => typeof value === "string" && value.length > 0,
    ],
  },
  extensions: {
    reported_session_id: [
      (value) => typeof value === "string" && value.length > 0,
    ],
  },
});

export default VALIDATOR_RULES_MAP;
