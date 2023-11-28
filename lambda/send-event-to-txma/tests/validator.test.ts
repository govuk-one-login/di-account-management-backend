import validateObject from "../validator";
import validatorRules, { ValidationRules } from "../validator-rules";
import { SuspiciousActivityEvent } from "../models";

describe("validate", () => {
  let suspiciousActivityEvent: SuspiciousActivityEvent;
  let suspiciousActivityEventRule: ValidationRules | undefined;
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  beforeEach(() => {
    suspiciousActivityEvent = {
      user_id: "1234567",
      email_address: "test@test.com",
      persistent_session_id: "111111",
      session_id: "111112",
      reported: true,
      reported_event: {
        event_type: "HOME_REPORT_SUSPICIOUS_ACTIVITY",
        session_id: "111111",
        user_id: "1111111",
        timestamp: 1609462861,
        activities: {
          type: "HOME_REPORT_SUSPICIOUS_ACTIVITY",
          client_id: "111111",
          timestamp: 1609462861,
          event_id: "1111111",
        },
      },
    };
    suspiciousActivityEventRule = validatorRules.get(
      "HOME_REPORT_SUSPICIOUS_ACTIVITY"
    );
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("successful validate report suspicious event", async () => {
    const result = validateObject(
      suspiciousActivityEvent,
      suspiciousActivityEventRule
    );
    expect(result).toBe(true);
  });
  test("fails validate when invalid report suspicious event", async () => {
    const invalidSuspiciousActivityEvent = {
      session_id: "111112",
      reported: true,
      reported_event: {
        timestamp: 1609462861,
        activities: {
          event_id: "1111111",
        },
      },
    };
    const result = validateObject(
      invalidSuspiciousActivityEvent,
      suspiciousActivityEventRule
    );
    expect(result).toBe(false);
  });
  test("fails is undefined object is passed", async () => {
    const result = validateObject(
      undefined,
      suspiciousActivityEventRule
    );
    expect(result).toBe(false);
  });
  test("fails is undefined validator rule is passed", async () => {
    const result = validateObject(suspiciousActivityEvent, undefined);
    expect(result).toBe(false);
  });
});
