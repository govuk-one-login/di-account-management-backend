interface ValidationRule {
  (value: any): boolean;
}

interface ValidationRules {
  [key: string]: ValidationRule[];
}

function validateObject(
  obj: Record<string, any>,
  rules: ValidationRules
): boolean {
  // eslint-disable-next-line no-restricted-syntax
  for (const key in rules) {
    // eslint-disable-next-line no-prototype-builtins
    if (obj.hasOwnProperty(key)) {
      // eslint-disable-next-line no-restricted-syntax
      for (const rule of rules[key]) {
        if (!rule(obj[key])) {
          return false;
        }
      }

      // Check for nested objects and recursively validate them
      if (typeof obj[key] === "object" && rules[key]) {
        if (!validateObject(obj[key], rules[key])) {
          return false;
        }
      }
    }
  }
  return true;
}

