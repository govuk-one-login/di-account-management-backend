import VALIDATOR_RULES_MAP, {
  ValidationRule,
  ValidationRules,
} from "./validator-rules";

function validateObject(
  obj: Record<string, any>,
  rules: ValidationRules | undefined
): boolean {
  // eslint-disable-next-line no-restricted-syntax
  for (const key in rules) {
    // eslint-disable-next-line no-prototype-builtins
    if (obj.hasOwnProperty(key)) {
      // eslint-disable-next-line no-restricted-syntax
      if (typeof obj[key] !== "object") {
        const ruleValue: ValidationRule[] = rules[key] as ValidationRule[];
        // eslint-disable-next-line no-restricted-syntax
        for (const rule of ruleValue) {
          if (!rule(obj[key])) {
            return false;
          }
        }
      }
      // Check for nested objects and recursively validate them
      if (typeof obj[key] === "object" && (rules[key] as ValidationRules)) {
        if (!validateObject(obj[key], VALIDATOR_RULES_MAP.get(obj[key]))) {
          return false;
        }
      }
    }
  }
  return true;
}

export default validateObject;
