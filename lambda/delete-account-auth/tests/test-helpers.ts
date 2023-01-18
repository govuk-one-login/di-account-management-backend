import type { SNSEvent, SNSMessage, SNSEventRecord } from "aws-lambda";

export const TEST_SNS_MESSAGE_CONTENT = {
  user_id: "user-id",
  access_token: "test-access-token",
  email: "test@testemail.com",
  source_ip: "test-source_ip",
  persistent_session_id: "test-persistent_session_id",
  session_id: "test-session_id",
  public_subject_id: "tedt-public_subject_id",
  legacy_subject_id: "test-legacy_subject_id",
};

const TEST_SNS_MESSAGE: SNSMessage = {
  SignatureVersion: "SignatureVersion",
  Timestamp: "Timestamp",
  Signature: "Signature",
  SigningCertUrl: "SigningCertUrl",
  MessageId: "MessageId",
  Message: JSON.stringify(TEST_SNS_MESSAGE_CONTENT),
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
  Records: [TEST_SNS_EVENT_RECORD, TEST_SNS_EVENT_RECORD],
};
