// Create a Map with string keys and any values
import { ValidationRulesKeyEnum } from "./constants";

const VALIDATOR_RULES_MAP = new Map<string, ValidationRules>();

VALIDATOR_RULES_MAP.set(
  ValidationRulesKeyEnum.HOME_REPORT_SUSPICIOUS_ACTIVITY,
  {
    event_timestamp_ms: [
      (value) => typeof value === "string" && value.length > 0,
      (value) => /^[a-zA-Z0-9_]+$/.test(value),
    ],
    age: [(value) => typeof value === "number" && value >= 18],
      component_id: [
      (value) =>
        typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    ],
      user: {
          user_id: [(value: string) => typeof value === "string" && value.length > 0],
          session_id: [
        (value: string) =>
          typeof value === "string" && /^[a-zA-Z0-9 ]+$/.test(value),
      ],
    },
  }
);
VALIDATOR_RULES_MAP.set(ValidationRulesKeyEnum.TXMA_EVENT, {
    event_timestamp_ms: [
        (value) => typeof value === "string" && value.length > 0,
        (value) => /^[a-zA-Z0-9_]+$/.test(value),
    ],
    age: [(value) => typeof value === "number" && value >= 18],
    component_id: [
        (value) =>
            typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    ],
    user: {
        user_id: [(value: string) => typeof value === "string" && value.length > 0],
        session_id: [
            (value: string) =>
                typeof value === "string" && /^[a-zA-Z0-9 ]+$/.test(value),
        ],
    },
}
});

export default VALIDATOR_RULES_MAP;
