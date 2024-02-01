import { SQSRecord } from "aws-lambda";
import {
  Service,
  TxmaEvent,
  UserRecordEvent,
  UserServices,
} from "../common/model";
import { clientId, sessionId, userId } from "./testFixtures";

export const makeServiceRecord = (
  clientId: string,
  count: number,
  date?: number
): Service => {
  const fallbackDate = new Date(2022, 0, 1).valueOf();
  const formattedDate = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
  }).format(new Date(date || fallbackDate));
  return {
    client_id: clientId,
    count_successful_logins: count,
    last_accessed: date || fallbackDate,
    last_accessed_pretty: formattedDate,
  };
};

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

export const makeTxmaEvent = (
  localclientId?: string,
  localuserId?: string,
  eventName?: string,
  date?: number
): TxmaEvent => ({
  event_name: eventName ?? "event_1",
  event_id: "event_id",
  timestamp: date ?? 1670850655485,
  timestamp_formatted: "",
  client_id: localclientId ?? clientId,
  user: {
    user_id: localuserId ?? userId,
    access_token: "",
    govuk_signin_journey_id: "",
    public_subject_id: "",
    session_id: sessionId,
  },
});

export const makeSQSFixture = (
  payloadBodies: [UserRecordEvent | UserServices]
): SQSRecord[] =>
  payloadBodies.map((payloadBody) => makeSQSEventFixture(payloadBody));

export const makeSQSInputFixture = (
  payloadBodies: [UserRecordEvent]
): SQSRecord[] => makeSQSFixture(payloadBodies);
