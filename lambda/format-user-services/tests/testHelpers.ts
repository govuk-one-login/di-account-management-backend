import type { SQSRecord } from "aws-lambda";

import type {
  Service,
  UserRecordEvent,
  UserServices,
  TxmaEvent,
} from "../models";

export const makeServiceRecord = (
  clientId: string,
  count: number,
  date?: number
): Service => ({
  client_id: clientId,
  count_successful_logins: count,
  last_accessed: date || new Date().valueOf(),
});

export const makeSQSEventFixture = (
  payloadBody: UserRecordEvent | UserServices
): SQSRecord => ({
  messageId: "19dd0b57-b21e-4ac1-bd88-01bbb068cb78",
  receiptHandle: "MessageReceiptHandle",
  body: JSON.stringify(payloadBody),
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
});

export const makeTxmaEvent = (clientId: string, userId: string): TxmaEvent => ({
  event_name: "event_1",
  event_id: "event_id",
  timestamp: 1670850655485,
  timestamp_formatted: "2022-12-12T13:10:55.485Z",
  client_id: clientId,
  user: {
    user_id: userId,
    govuk_signin_journey_id: "abc123",
  },
});

export const makeSQSFixture = (
  payloadBodies: [UserRecordEvent | UserServices]
): SQSRecord[] =>
  payloadBodies.map((payloadBody) => makeSQSEventFixture(payloadBody));

export const makeSQSInputFixture = (
  payloadBodies: [UserRecordEvent]
): SQSRecord[] => makeSQSFixture(payloadBodies);
