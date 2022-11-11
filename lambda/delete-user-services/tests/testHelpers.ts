import type { SNSEvent, SNSMessage, SNSEventRecord } from "aws-lambda";

export const TEST_USER_DATA = {
  user_id: "user-id",
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

const TEST_SNS_EVENT_RECORD: SNSEventRecord = {
  EventVersion: "1",
  EventSubscriptionArn: "arn",
  EventSource: "source",
  Sns: TEST_SNS_MESSAGE,
};

export const TEST_SNS_EVENT: SNSEvent = {
  Records: [TEST_SNS_EVENT_RECORD, TEST_SNS_EVENT_RECORD],
};
