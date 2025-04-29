import validateObject from "../common/validator";
import validatorRules, { ValidationRules } from "../common/validator-rules";
import { ReportSuspiciousActivityEvent } from "../common/model";

describe("validate", () => {
  let suspiciousActivityEvent: ReportSuspiciousActivityEvent;
  let suspiciousActivityEventRule: ValidationRules | undefined;
  beforeEach(() => {
    suspiciousActivityEvent = {
      event_id: "522c5ab4-7e66-4b2a-8f5c-4d31dc4e93e6",
      event_type: "HOME_REPORT_SUSPICIOUS_ACTIVITY",
      session_id: "session_id",
      persistent_session_id: "persistent_session_id",
      email_address: "email",
      component_id: "https://home.account.gov.uk",
      timestamp: 1708971886,
      event_timestamp_ms: 1708971886515,
      event_timestamp_ms_formatted: "2024-02-26T18:24:46.515Z",
      timestamp_formatted: "2024-02-26T18:24:46.515Z",
      suspicious_activity: {
        event_type: "TXMA_EVENT",
        session_id: "123456789",
        user_id: "qwerty",
        timestamp: 123456789,
        client_id: "gov-uk",
        event_id: "ab12345a-a12b-3ced-ef12-12a3b4cd5678",
        reported_suspicious: true,
      },
      zendesk_ticket_id: "12345677",
      notify_message_id: "12345678",
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
    const result = validateObject(undefined, suspiciousActivityEventRule);
    expect(result).toBe(false);
  });
  test("fails is undefined validator rule is passed", async () => {
    const result = validateObject(suspiciousActivityEvent);
    expect(result).toBe(false);
  });
});
