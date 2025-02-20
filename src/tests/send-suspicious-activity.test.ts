import "aws-sdk-client-mock-jest";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { mockClient } from "aws-sdk-client-mock";

import { handler, sendAuditEvent } from "../send-suspicious-activity";
import { ReportSuspiciousActivityEvent, TxMAAuditEvent } from "../common/model";
import { sendSqsMessage } from "../common/sqs";

const sqsMock = mockClient(SQSClient);
const TXMA_QUEUE_URL = "TXMA_QUEUE_URL";

describe("sendAuditEventToTxMA", () => {
  beforeEach(() => {
    sqsMock.reset();
    sqsMock.on(SendMessageCommand).resolves({ MessageId: "MessageId" });
    process.env.AWS_REGION = "AWS_REGION";
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("send audit event successfully", async () => {
    const consoleLog = jest.spyOn(console, "log").mockImplementation();
    const txMAEvent: TxMAAuditEvent = {
      user: {
        user_id: "qwerty",
        persistent_session_id: "persistent_session_id",
        session_id: "session_id",
      },
      component_id: "https://home.account.gov.uk",
      event_name: "HOME_REPORT_SUSPICIOUS_ACTIVITY",
      timestamp: 1708971886,
      event_timestamp_ms: 1708971886515,
      event_timestamp_ms_formatted: "2024-02-26T18:24:46.515Z",
      extensions: {
        zendesk_ticket_number: "12345677",
        notify_reference: "12345678",
        suspicious_activities: [
          {
            event_id: "ab12345a-a12b-3ced-ef12-12a3b4cd5678",
            event_type: "TXMA_EVENT",
            session_id: "123456789",
            timestamp: 123456789,
            client_id: "govuk",
          },
        ],
      },
    };
    await sendAuditEvent(txMAEvent, TXMA_QUEUE_URL);
    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(1);
    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl: "TXMA_QUEUE_URL",
      MessageBody: JSON.stringify(txMAEvent),
    });
    expect(consoleLog).toHaveBeenCalledWith(
      "[Message sent to QUEUE] with message id = MessageId"
    );
  });

  test("send audit event fails and handles error correctly", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation();
    const txMAEvent: TxMAAuditEvent = {
      user: {
        user_id: "qwerty",
        persistent_session_id: "persistent_session_id",
        session_id: "session_id",
      },
      component_id: "https://home.account.gov.uk",
      event_name: "HOME_REPORT_SUSPICIOUS_ACTIVITY",
      timestamp: 1708971886,
      event_timestamp_ms: 1708971886515,
      event_timestamp_ms_formatted: "2024-02-26T18:24:46.515Z",
      extensions: {
        zendesk_ticket_number: "12345677",
        notify_reference: "12345678",
        suspicious_activities: [
          {
            event_id: "ab12345a-a12b-3ced-ef12-12a3b4cd5678",
            event_type: "TXMA_EVENT",
            session_id: "123456789",
            timestamp: 123456789,
            client_id: "govuk",
          },
        ],
      },
    };

    sqsMock.on(SendMessageCommand).rejects("SomeSQSError");
    await expect(
      sendAuditEvent(txMAEvent, TXMA_QUEUE_URL)
    ).rejects.toMatchObject({
      message: "SomeSQSError",
    });
    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl: "TXMA_QUEUE_URL",
      MessageBody: JSON.stringify(txMAEvent),
    });
    expect(consoleError).toHaveBeenCalledWith(
      "Error occurred trying to send the audit event to the TxMA queue: SomeSQSError"
    );
  });
});

describe("sendSQSMessage", () => {
  beforeEach(() => {
    process.env.TXMA_QUEUE_URL = TXMA_QUEUE_URL;
    process.env.AWS_REGION = "AWS_REGION";
    sqsMock.reset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("send sqs successfully", async () => {
    const txMAEvent: TxMAAuditEvent = {
      user: {
        user_id: "qwerty",
        persistent_session_id: "persistent_session_id",
        session_id: "session_id",
      },
      component_id: "https://home.account.gov.uk",
      event_name: "HOME_REPORT_SUSPICIOUS_ACTIVITY",
      timestamp: 1708971886,
      event_timestamp_ms: 1708971886515,
      event_timestamp_ms_formatted: "2024-02-26T18:24:46.515Z",
      extensions: {
        zendesk_ticket_number: "12345677",
        notify_reference: "12345678",
        suspicious_activities: [
          {
            event_id: "ab12345a-a12b-3ced-ef12-12a3b4cd5678",
            event_type: "TXMA_EVENT",
            session_id: "123456789",
            timestamp: 123456789,
            client_id: "govuk",
          },
        ],
      },
    };
    await sendSqsMessage(JSON.stringify(txMAEvent), "TXMA_QUEUE_URL");
    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(1);
    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl: "TXMA_QUEUE_URL",
      MessageBody: JSON.stringify(txMAEvent),
    });
  });
});

describe("handler", () => {
  beforeEach(() => {
    sqsMock.reset();
    process.env.EVENT_NAME = "HOME_REPORT_SUSPICIOUS_ACTIVITY";
    process.env.TXMA_QUEUE_URL = "TXMA_QUEUE_URL";
    sqsMock.on(SendMessageCommand).resolves({ MessageId: "MessageId" });
    jest.useFakeTimers();
    jest.setSystemTime(new Date(Date.UTC(2023, 20, 12)));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test("handler successfully sends audit event to txma", async () => {
    const consoleLog = jest.spyOn(console, "log").mockImplementation();
    const BASE64_ENCODED_DEVICE_INFO =
      "WEwuLXxLeGZPO2Fgcyo2V2R+KUQmUjFcc3V0SU4+L25WIT0+KzNVdkdKLGUnJVZKdzheUmtjblokNEhCLzNvaUB2PTZ3SVhMWDNua1d3a2tlSm1BPk8nVnYlKC9I%";
    const input: ReportSuspiciousActivityEvent = {
      event_id: "522c5ab4-7e66-4b2a-8f5c-4d31dc4e93e6",
      event_type: "HOME_REPORT_SUSPICIOUS_ACTIVITY",
      persistent_session_id: "persistent_session_id",
      session_id: "session_id",
      email_address: "email",
      component_id: "https://home.account.gov.uk",
      timestamp: 1708971886,
      event_timestamp_ms: 1708971886515,
      event_timestamp_ms_formatted: "2024-02-26T18:24:46.515Z",
      suspicious_activity: {
        event_type: "TXMA_EVENT",
        session_id: "123456789",
        user_id: "qwerty",
        timestamp: 123456789,
        client_id: "govuk",
        event_id: "ab12345a-a12b-3ced-ef12-12a3b4cd5678",
        reported_suspicious: true,
      },
      zendesk_ticket_id: "12345677",
      notify_message_id: "12345678",
      device_information: BASE64_ENCODED_DEVICE_INFO,
    };
    await handler(input);
    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(1);
    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl: "TXMA_QUEUE_URL",
      MessageBody: JSON.stringify({
        user: {
          user_id: "qwerty",
          persistent_session_id: "persistent_session_id",
          session_id: "session_id",
        },
        component_id: "https://home.account.gov.uk",
        event_name: "HOME_REPORT_SUSPICIOUS_ACTIVITY",
        timestamp: 1708971886,
        event_timestamp_ms: 1708971886515,
        event_timestamp_ms_formatted: "2024-02-26T18:24:46.515Z",
        extensions: {
          zendesk_ticket_number: "12345677",
          notify_reference: "12345678",
          suspicious_activities: [
            {
              event_id: "ab12345a-a12b-3ced-ef12-12a3b4cd5678",
              event_type: "TXMA_EVENT",
              session_id: "123456789",
              timestamp: 123456789,
              client_id: "govuk",
            },
          ],
        },
        restricted: {
          device_information: {
            encoded: BASE64_ENCODED_DEVICE_INFO,
          },
        },
      }),
    });
    expect(consoleLog).toHaveBeenCalledWith(
      "[Message sent to QUEUE] with message id = MessageId"
    );
  });

  test("handler successfully sends audit event to txma when no device information provided", async () => {
    const consoleLog = jest.spyOn(console, "log").mockImplementation();
    const input: ReportSuspiciousActivityEvent = {
      event_id: "522c5ab4-7e66-4b2a-8f5c-4d31dc4e93e6",
      event_type: "HOME_REPORT_SUSPICIOUS_ACTIVITY",
      persistent_session_id: "persistent_session_id",
      session_id: "session_id",
      email_address: "email",
      component_id: "https://home.account.gov.uk",
      timestamp: 1708971886,
      event_timestamp_ms: 1708971886515,
      event_timestamp_ms_formatted: "2024-02-26T18:24:46.515Z",
      suspicious_activity: {
        event_type: "TXMA_EVENT",
        session_id: "123456789",
        user_id: "qwerty",
        timestamp: 123456789,
        client_id: "govuk",
        event_id: "ab12345a-a12b-3ced-ef12-12a3b4cd5678",
        reported_suspicious: true,
      },
      zendesk_ticket_id: "12345677",
      notify_message_id: "12345678",
    };
    await handler(input);
    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(1);
    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl: "TXMA_QUEUE_URL",
      MessageBody: JSON.stringify({
        user: {
          user_id: "qwerty",
          persistent_session_id: "persistent_session_id",
          session_id: "session_id",
        },
        component_id: "https://home.account.gov.uk",
        event_name: "HOME_REPORT_SUSPICIOUS_ACTIVITY",
        timestamp: 1708971886,
        event_timestamp_ms: 1708971886515,
        event_timestamp_ms_formatted: "2024-02-26T18:24:46.515Z",
        extensions: {
          zendesk_ticket_number: "12345677",
          notify_reference: "12345678",
          suspicious_activities: [
            {
              event_id: "ab12345a-a12b-3ced-ef12-12a3b4cd5678",
              event_type: "TXMA_EVENT",
              session_id: "123456789",
              timestamp: 123456789,
              client_id: "govuk",
            },
          ],
        },
      }),
    });
    expect(consoleLog).toHaveBeenCalledWith(
      "[Message sent to QUEUE] with message id = MessageId"
    );
  });
});

describe("handler error handling", () => {
  beforeEach(() => {
    sqsMock.reset();
    process.env.EVENT_NAME = "ANOTHER_EVENT_NAME";
    sqsMock.on(SendMessageCommand).resolves({ MessageId: "MessageId" });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("logs the error message", async () => {
    const input: ReportSuspiciousActivityEvent = {
      event_id: "522c5ab4-7e66-4b2a-8f5c-4d31dc4e93e6",
      event_type: "HOME_REPORT_SUSPICIOUS_ACTIVITY",
      persistent_session_id: "persistent_session_id",
      session_id: "session_id",
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
        client_id: "govuk",
        event_id: "ab12345a-a12b-3ced-ef12-12a3b4cd5678",
        reported_suspicious: true,
      },
      zendesk_ticket_id: "12345677",
      notify_message_id: "12345678",
    };
    let errorThrown = false;
    let errorMessage = "";
    try {
      await handler(input);
    } catch (error) {
      errorThrown = true;
      errorMessage = (error as Error).message;
    }
    expect(errorThrown).toBeTruthy();
    expect(errorMessage).toContain(
      'Error occurred sending event to TxMA: Received Event: {"event_id":"522c5ab4-7e66-4b2a-8f5c-4d31dc4e93e6","event_type":"HOME_REPORT_SUSPICIOUS_ACTIVITY","persistent_session_id":"persistent_session_id","session_id":"session_id","email_address":"email","component_id":"https://home.account.gov.uk","timestamp":1708971886,"event_timestamp_ms":1708971886515,"event_timestamp_ms_formatted":"2024-02-26T18:24:46.515Z","timestamp_formatted":"2024-02-26T18:24:46.515Z","suspicious_activity":{"event_type":"TXMA_EVENT","session_id":"123456789","user_id":"qwerty","timestamp":123456789,"client_id":"govuk","event_id":"ab12345a-a12b-3ced-ef12-12a3b4cd5678","reported_suspicious":true},"zendesk_ticket_id":"12345677","notify_message_id":"12345678"'
    );
  });
});
