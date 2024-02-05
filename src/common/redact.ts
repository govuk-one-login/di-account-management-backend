const redact = (jsonString: string, fieldsToRedact: string[]): string => {
  const jsonObject: Record<string, unknown> = JSON.parse(jsonString);

  function redact(obj: Record<string, unknown>) {
    for (const key in obj) {
      if (typeof obj[key] === "object") {
        redact(obj[key] as Record<string, unknown>);
      } else {
        if (fieldsToRedact.includes(key)) {
          obj[key] = "REDACTED";
        }
      }
    }
  }

  redact(jsonObject);
  return JSON.stringify(jsonObject);
};

export default redact;
