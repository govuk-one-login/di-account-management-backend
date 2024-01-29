// TODO: remove lint exclusion
/* eslint-disable @typescript-eslint/no-unused-vars */
import VALIDATOR_RULES_MAP, {
  ValidationRule,
  ValidationRules,
} from "./validator-rules";

function validateObject(
  // TODO: Remove lint exclusion
  /* eslint-disable @typescript-eslint/no-explicit-any */
  event?: Record<string, any>,
  validationRules?: ValidationRules | undefined
): boolean {
  if (event && validationRules) {
    for (const key in validationRules) {
      if (Object.keys(event).includes(key)) {
        const value = event[key];
        const rules: ValidationRule[] = validationRules[
          key
        ] as ValidationRule[];
        // eslint-disable-next-line no-restricted-syntax
        if (typeof event[key] !== "object") {
          // eslint-disable-next-line no-restricted-syntax
          for (const rule of rules) {
            if (!rule(value)) {
              return false;
            }
          }
        }
        // Check for nested objects and recursively validate them
        if (typeof value === "object" && rules) {
          if (!validateObject(value, rules as unknown as ValidationRules)) {
            return false;
          }
        }
      } else {
        return false;
      }
    }
  } else {
    return false;
  }
  return true;
}

export default validateObject;
