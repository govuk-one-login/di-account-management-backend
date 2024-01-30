import { SNSEvent, SNSEventRecord, SNSMessage } from "aws-lambda";

export const TABLE_NAME = 'ACTIVITY_LOG'
export const INDEX_NAME = 'EventIdIndex'
export const USER_ID = 'user1'
export const TIMESTAMP = 123
export const EVENT_ID = 'abc'
export const DLQ_URL = 'dql'


const TEST_SNS_MESSAGE: SNSMessage = {
  SignatureVersion: "SignatureVersion",
  Timestamp: "Timestamp",
  Signature: "Signature",
  SigningCertUrl: "SigningCertUrl",
  MessageId: "MessageId",
  Message: JSON.stringify({
    user_id: USER_ID,
    timestamp: TIMESTAMP,
    event_id: EVENT_ID
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
