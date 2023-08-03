import type { SNSEvent, SNSMessage, SNSEventRecord } from "aws-lambda";

export const TEST_USER_DATA = {
  user_id: "user-id",
  access_token: "access_token",
  email: "email",
  source_ip: "source_ip",
  persistent_session_id: "persistent_session_id",
  session_id: "session_id",
  public_subject_id: "public_subject_id",
  legacy_subject_id: "legacy_subject_id",
};

const TEST_SNS_MESSAGE: SNSMessage = {
  SignatureVersion: "SignatureVersion",
  Timestamp: "Timestamp",
  Signature: "Signature",
  SigningCertURL: "SigningCertUrl",
  MessageId: "MessageId",
  Message: JSON.stringify(TEST_USER_DATA),
  MessageAttributes: {},
  Type: "Type",
  UnsubscribeURL: "unsubscribeUrl",
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
