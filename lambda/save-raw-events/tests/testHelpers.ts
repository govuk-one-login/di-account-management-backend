import { SQSEvent, SQSRecord } from "aws-lambda";
import { TxmaEvent, UserData } from "../models";

const userId = "user_id";
const user: UserData = {
  user_id: userId,
  govuk_signin_journey_id: "govuk_signin_journey_id",
};

export const date = new Date();

export const TEST_TXMA_EVENT: TxmaEvent = {
  event_id: "ab12345a-a12b-3ced-ef12-12a3b4cd5678",
  timestamp: date.getTime(),
  timestamp_formatted: date.toISOString(),
  event_name: "AUTH_AUTH_CODE_ISSUED",
  client_id: "client_id",
  user,
};

const TEST_SQS_RECORD: SQSRecord = {
  messageId: "19dd0b57-b21e-4ac1-bd88-01bbb068cb78",
  receiptHandle: "MessageReceiptHandle",
  body: JSON.stringify(TEST_TXMA_EVENT),
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
