import { SQSEvent, SQSRecord } from "aws-lambda";

const TEST_SQS_RECORD: SQSRecord = {
  messageId: "19dd0b57-b21e-4ac1-bd88-01bbb068cb78",
  receiptHandle: "MessageReceiptHandle",
  body: JSON.stringify({
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
  attributes: {
    ApproximateReceiveCount: "1",
    SentTimestamp: "1523232000000",
    SenderId: "123456789012",
    ApproximateFirstReceiveTimestamp: "1523232000001",
  },
  messageAttributes: {},
  md5OfBody: "7b270e59b47ff90a553787216d55d91d",
  eventSource: "aws:sqs",
  eventSourceARN: "arn:aws:sqs:us-east-1:123456789012:MyQueue",
  awsRegion: "us-east-1",
};

export const TEST_SQS_EVENT: SQSEvent = {
  Records: [TEST_SQS_RECORD],
};
