import type { SNSMessage } from "aws-lambda";

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
  SigningCertUrl: "SigningCertUrl",
  MessageId: "MessageId",
  Message: JSON.stringify(TEST_USER_DATA),
  MessageAttributes: {},
  Type: "Type",
  UnsubscribeUrl: "unsubscribeUrl",
  TopicArn: "TopicArn",
  Subject: "Subject",
};
