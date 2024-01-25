import { SQSEvent, SQSRecord } from "aws-lambda";
import { UserServices } from "../models";

export const date = new Date();
export const tableName = "TableName";
export const clientId = "clientId";
export const userId = "userId";
export const TEST_USER_SERVICES: UserServices = {
  user_id: userId,
  services: [
    {
      client_id: clientId,
      last_accessed: date.valueOf(),
      last_accessed_pretty: new Intl.DateTimeFormat("en-GB", {
        dateStyle: "long",
      }).format(date),
      count_successful_logins: 1,
    },
  ],
};

const TEST_SQS_RECORD: SQSRecord = {
  messageId: "19dd0b57-b21e-4ac1-bd88-01bbb068cb78",
  receiptHandle: "MessageReceiptHandle",
  body: JSON.stringify(TEST_USER_SERVICES),
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
  Records: [TEST_SQS_RECORD, TEST_SQS_RECORD],
};
