// Create a Map with string keys and any values
import { ValidationRulesKeyEnum } from "./constants";

const VALIDATOR_RULES_MAP = new Map<string, ValidationRules>();

VALIDATOR_RULES_MAP.set(
  ValidationRulesKeyEnum.HOME_REPORT_SUSPICIOUS_ACTIVITY,
  {
    username: [
      (value) => typeof value === "string" && value.length > 0,
      (value) => /^[a-zA-Z0-9_]+$/.test(value),
    ],
    age: [(value) => typeof value === "number" && value >= 18],
    email: [
      (value) =>
        typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    ],
    address: {
      city: [(value: string) => typeof value === "string" && value.length > 0],
      postalCode: [
        (value: string) =>
          typeof value === "string" && /^[a-zA-Z0-9 ]+$/.test(value),
      ],
    },
  }
);
VALIDATOR_RULES_MAP.set(ValidationRulesKeyEnum.TXMA_EVENT, {
  username: [
    (value) => typeof value === "string" && value.length > 0,
    (value) => /^[a-zA-Z0-9_]+$/.test(value),
  ],
  age: [(value) => typeof value === "number" && value >= 18],
  email: [
    (value) =>
      typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  ],
  address: {
    city: [(value: string) => typeof value === "string" && value.length > 0],
    postalCode: [
      (value: string) =>
        typeof value === "string" && /^[a-zA-Z0-9 ]+$/.test(value),
    ],
  },
});

export default VALIDATOR_RULES_MAP;
