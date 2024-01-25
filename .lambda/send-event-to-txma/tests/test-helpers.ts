import { SNSEvent, SNSEventRecord, SNSMessage } from "aws-lambda";

const TEST_SNS_MESSAGE: SNSMessage = {
  SignatureVersion: "SignatureVersion",
  Timestamp: "Timestamp",
  Signature: "Signature",
  SigningCertUrl: "SigningCertUrl",
  MessageId: "MessageId",
  Message: JSON.stringify({
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
  }),
  MessageAttributes: {},
  Type: "Type",
  UnsubscribeUrl: "unsubscribeUrl",
  TopicArn: "TopicArn",
  Subject: "Subject",
};

const TEST_SNS_EVENT_RECORD: SNSEventRecord = {
  EventVersion: "1",
  EventSubscriptionArn: "arn",
  EventSource: "source",
  Sns: TEST_SNS_MESSAGE,
};

export const TEST_SNS_EVENT: SNSEvent = {
  Records: [TEST_SNS_EVENT_RECORD],
};
