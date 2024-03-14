import {
  ActivityLogEntry,
  EncryptedActivityLogEntry,
  MarkActivityAsReportedInput,
  ReportSuspiciousActivityEvent,
  TxmaEvent,
  UserData,
  UserServices,
} from "../common/model";
import {
  DynamoDBRecord,
  DynamoDBStreamEvent,
  SNSEvent,
  SNSEventRecord,
  SNSMessage,
  SQSEvent,
  SQSRecord,
} from "aws-lambda";

export const eventId = "ab12345a-a12b-3ced-ef12-12a3b4cd5678";
export const eventType = "TXMA_EVENT";
export const sessionId = "123456789";
export const userId = "qwerty";
export const Mon_Mar_11_11_06_16_GMT_2024 = 1710155176;
export const activity_timestamp = Mon_Mar_11_11_06_16_GMT_2024;
export const timestamp = 123456789;
export const clientId = "client-id-value";
export const reportedSuspicious = false;
export const txmaEventId = "event_id";
export const authCodeIssuedEventType = "AUTH_AUTH_CODE_ISSUED";
export const randomEventType = "AUTH_OTHER_RANDOM_EVENT";
export const queueUrl = "http://my_queue_url";
export const messageId = "MyMessageId";
export const tableName = "tableName";
export const indexName = "indexName";

export const createSnsEvent = (message: unknown): SNSEvent => {
  const TEST_SNS_MESSAGE: SNSMessage = {
    SignatureVersion: "SignatureVersion",
    Timestamp: "Timestamp",
    Signature: "Signature",
    SigningCertUrl: "SigningCertUrl",
    MessageId: "MessageId",
    Message: JSON.stringify(message),
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

  return {
    Records: [TEST_SNS_EVENT_RECORD],
  };
};

export const user: UserData = {
  user_id: userId,
  session_id: sessionId,
};

export const TEST_ACTIVITY_LOG_ENTRY: ActivityLogEntry = {
  event_type: eventType,
  session_id: sessionId,
  user_id: userId,
  timestamp,
  event_id: eventId,
  client_id: clientId,
  reported_suspicious: reportedSuspicious,
};

export const TEST_USER_DATA: UserData = {
  user_id: "user-id",
  access_token: "access_token",
  email: "email",
  source_ip: "source_ip",
  persistent_session_id: "persistent_session_id",
  session_id: "session_id",
  public_subject_id: "public_subject_id",
  legacy_subject_id: "legacy_subject_id",
  govuk_signin_journey_id: "",
};

export const MUTABLE_USER_DATA: UserData = {
  access_token: "",
  public_subject_id: "",
  user_id: userId,
  govuk_signin_journey_id: "234567",
  session_id: sessionId,
};

export const TEST_SNS_MESSAGE: SNSMessage = {
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

export const TEST_SNS_EVENT_RECORD: SNSEventRecord = {
  EventVersion: "1",
  EventSubscriptionArn: "arn",
  EventSource: "source",
  Sns: TEST_SNS_MESSAGE,
};

export const TEST_SNS_EVENT: SNSEvent = {
  Records: [TEST_SNS_EVENT_RECORD],
};

export const TEST_SNS_EVENT_WITH_TWO_RECORDS: SNSEvent = {
  Records: [TEST_SNS_EVENT_RECORD, TEST_SNS_EVENT_RECORD],
};

const NO_USER_ID = { ...TEST_ACTIVITY_LOG_ENTRY, user_id: undefined };
export const ACTIVITY_LOG_ENTRY_NO_USER_ID: ActivityLogEntry = JSON.parse(
  JSON.stringify(NO_USER_ID)
);

const NO_TIMESTAMP = { ...TEST_ACTIVITY_LOG_ENTRY, timestamp: undefined };
export const ACTIVITY_LOG_ENTRY_NO_TIMESTAMP: ActivityLogEntry = JSON.parse(
  JSON.stringify(NO_TIMESTAMP)
);

export const TEST_SQS_RECORD: SQSRecord = {
  messageId: "19dd0b57-b21e-4ac1-bd88-01bbb068cb78",
  receiptHandle: "MessageReceiptHandle",
  body: JSON.stringify(TEST_ACTIVITY_LOG_ENTRY),
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

export const TEST_ENCRYPTED_ACTIVITY_LOG_ENTRY: EncryptedActivityLogEntry = {
  event_type: eventType,
  session_id: sessionId,
  user_id: userId,
  timestamp: activity_timestamp,
  client_id: clientId,
  event_id: eventId,
  reported_suspicious: reportedSuspicious,
};

export const MUTABLE_TXMA_EVENT: TxmaEvent = {
  event_id: txmaEventId,
  timestamp: activity_timestamp,
  timestamp_formatted: "x",
  event_name: authCodeIssuedEventType,
  client_id: clientId,
  user: MUTABLE_USER_DATA,
};

export const MUTABLE_ACTIVITY_LOG_ENTRY: ActivityLogEntry = {
  event_id: txmaEventId,
  event_type: authCodeIssuedEventType,
  session_id: sessionId,
  user_id: userId,
  client_id: clientId,
  timestamp: activity_timestamp,
  reported_suspicious: false,
};

// TODO: This would be better placed in testUtils but fails to be imported as a function when moved there.
export const generateDynamoSteamRecord = (
  txmaEventName = "AUTH_AUTH_CODE_ISSUED"
): DynamoDBRecord => ({
  eventID: "1234567",
  eventName: "INSERT",
  dynamodb: {
    ApproximateCreationDateTime: Date.now(),
    NewImage: {
      remove_at: {
        N: "1676378763",
      },
      id: { S: "event-id" },
      timestamp: { N: `${Date.now()}` },
      event: {
        M: {
          event_name: { S: txmaEventName },
          event_id: { S: txmaEventId },
          user: {
            M: {
              user_id: { S: userId },
              session_id: { S: sessionId },
            },
          },
          client_id: { S: clientId },
          txma: { M: { configVersion: { S: "2.2.1" } } },
          timestamp: { N: `${activity_timestamp}` },
        },
      },
    },
  },
});

export const TEST_DYNAMO_STREAM_EVENT: DynamoDBStreamEvent = {
  Records: [generateDynamoSteamRecord(), generateDynamoSteamRecord()],
};

export const MUCKY_DYNAMODB_STREAM_EVENT: DynamoDBStreamEvent = {
  Records: [generateDynamoSteamRecord(randomEventType)],
};

export const ERROR_DYNAMODB_STREAM_EVENT: DynamoDBStreamEvent = {
  Records: [
    {
      eventID: "1234567",
      eventName: "INSERT",
      dynamodb: {},
    },
  ],
};

export const exampleArn =
  "arn:aws:kms:eu-west-2:111122223333:key/bc436485-5092-42b8-92a3-0aa8b93536dc";

export const TEST_USER_SERVICES: UserServices = {
  user_id: userId,
  services: [
    {
      client_id: clientId,
      last_accessed: timestamp,
      last_accessed_pretty: new Intl.DateTimeFormat("en-GB", {
        dateStyle: "long",
      }).format(timestamp),
      count_successful_logins: 1,
    },
  ],
};

export const TEST_SQS_RECORD_WITH_USER_SERVICES: SQSRecord = {
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
export const TEST_SQS_EVENT_WITH_USER_SERVICES: SQSEvent = {
  Records: [
    TEST_SQS_RECORD_WITH_USER_SERVICES,
    TEST_SQS_RECORD_WITH_USER_SERVICES,
  ],
};

export const testSuspiciousActivity: MarkActivityAsReportedInput = {
  user_id: userId,
  email: "email",
  event_id: eventId,
  persistent_session_id: "persistent_session_id",
  session_id: "session_id",
  reported_suspicious_time: timestamp,
};

export const testSuspiciousActivityInput: ReportSuspiciousActivityEvent = {
  event_id: "522c5ab4-7e66-4b2a-8f5c-4d31dc4e93e6",
  event_type: "HOME_REPORT_SUSPICIOUS_ACTIVITY",
  session_id: "session_id",
  persistent_session_id: "persistent_session_id",
  email_address: "email",
  component_id: "https://home.account.gov.uk",
  timestamp: 1708971886,
  event_timestamp_ms: 1708971886515,
  event_timestamp_ms_formatted: "2024-02-26T18:24:46.515Z",
  timestamp_formatted: "2024-02-26T18:24:46.515Z",
  suspicious_activity: {
    event_type: "TXMA_EVENT",
    session_id: "123456789",
    user_id: "qwerty",
    timestamp: 123456789,
    client_id: "gov-uk",
    event_id: "ab12345a-a12b-3ced-ef12-12a3b4cd5678",
    reported_suspicious: true,
  },
};
