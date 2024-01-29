import { mockClient } from "aws-sdk-client-mock";
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { buildEncrypt, MessageHeader } from "@aws-crypto/client-node";
import { when } from "jest-when";
import encryptData from "../common/encrypt-data";
import { SQSEvent, SQSRecord } from "aws-lambda";
import {
  ActivityLogEntry,
  EncryptedActivityLogEntry,
} from "../common/write-activity-log-models";

export const eventId = "event_id";
export const eventType = "TXMA_EVENT";
export const sessionId = "123456789";
export const userId = "qwerty";
export const timestamp = 123456789;
export const clientId = "client-id-value";
export const reportedSuspicious = true;

export const TEST_ACTIVITY_LOG_ENTRY: ActivityLogEntry = {
  event_type: eventType,
  session_id: sessionId,
  user_id: userId,
  timestamp,
  event_id: eventId,
  client_id: clientId,
  reported_suspicious: reportedSuspicious,
};

const NO_ACTIVITY_ARRAY = { ...TEST_ACTIVITY_LOG_ENTRY, activities: undefined };
export const ACTIVITY_LOG_ENTRY_NO_ACTIVITY_ARRAY: ActivityLogEntry =
  JSON.parse(JSON.stringify(NO_ACTIVITY_ARRAY));

const NO_USER_ID = { ...TEST_ACTIVITY_LOG_ENTRY, user_id: undefined };
export const ACTIVITY_LOG_ENTRY_NO_USER_ID: ActivityLogEntry = JSON.parse(
  JSON.stringify(NO_USER_ID)
);

const NO_TIMESTAMP = { ...TEST_ACTIVITY_LOG_ENTRY, timestamp: undefined };
export const ACTIVITY_LOG_ENTRY_NO_TIMESTAMP: ActivityLogEntry = JSON.parse(
  JSON.stringify(NO_TIMESTAMP)
);

export const TEST_ACTIVITY_LOG_WITH_ACTIVITY_TYPE_UNDEFINED = {
  ...TEST_ACTIVITY_LOG_ENTRY,
};

const TEST_SQS_RECORD: SQSRecord = {
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
  timestamp,
  client_id: clientId,
  event_id: eventId,
  reported_suspicious: reportedSuspicious,
};

const mockedSecretsManager = mockClient(SecretsManagerClient).on(
  GetSecretValueCommand
);

jest.mock("@aws-crypto/client-node", () => ({
  buildEncrypt: jest.fn().mockReturnValue({
    encrypt: jest.fn(),
  }),
  KmsKeyringNode: jest.fn().mockImplementation(() => ({
    generatorKeyId: process.env.GENERATOR_KEY_ARN,
  })),
}));

describe("encryptData", () => {
  let encryptDataInput: {
    activityLogData: string;
    userId: string;
    jwt: string;
  };

  beforeEach(() => {
    const activityLogEntry = JSON.stringify(TEST_ACTIVITY_LOG_ENTRY);

    encryptDataInput = {
      activityLogData: activityLogEntry,
      userId: "test_user_123",
      jwt: "",
    };

    process.env.GENERATOR_KEY_ARN =
      "arn:aws:kms:eu-west-2:111122223333:key/bc436485-5092-42b8-92a3-0aa8b93536dc";
    process.env.VERIFY_ACCESS_VALUE = "access-param-test-value";
    process.env.ACCOUNT_ID = "12345";
    process.env.AWS_REGION = "GLOBAL";
    process.env.ENVIRONMENT = "dev";
    process.env.WRAPPING_KEY_ARN =
      "arn:aws:kms:eu-west-2:111122223333:key/49c5492b-b1bc-42a8-9a5c-b2015e810c1c";
    process.env.BACKUP_WRAPPING_KEY_ARN =
      "arn:aws:kms:eu-west-2:111122223333:key/49c5492b-b1bc-42a8-9a5c-b2015e810c1c";
  });

  it("should return the encryption result Base64 encoded", async () => {
    mockedSecretsManager.resolves({
      SecretString: "testSecretValue",
    });
    when(buildEncrypt().encrypt).mockResolvedValue({
      result: Buffer.from("testEncryptedDataString"),
      messageHeader: {} as MessageHeader,
    });
    const result = await encryptData(
      JSON.stringify(encryptDataInput.activityLogData),
      encryptDataInput.userId
    );
    expect(result).toEqual("dGVzdEVuY3J5cHRlZERhdGFTdHJpbmc=");
    expect(buildEncrypt).toHaveBeenCalled();
    expect(buildEncrypt().encrypt).toHaveBeenCalledWith(
      {
        generatorKeyId:
          "arn:aws:kms:eu-west-2:111122223333:key/bc436485-5092-42b8-92a3-0aa8b93536dc",
      },
      JSON.stringify(encryptDataInput.activityLogData),
      {
        encryptionContext: {
          accountId: process.env.ACCOUNT_ID,
          origin: process.env.AWS_REGION,
          accessCheckValue:
            "02403d3cf4369e4e6a73dd7ffbe46a076e8c4667b845e4b5273dc8e0083e1c9b",
          stage: process.env.ENVIRONMENT,
          userId: "test_user_123",
        },
      }
    );
  });

  it("should throw an Error if an exception is thrown while trying to encrypt the data with KMS", async () => {
    mockedSecretsManager.resolves({
      SecretString: "testSecretValue",
    });
    when(buildEncrypt().encrypt).mockRejectedValue(new Error("SomeKMSError"));
    await expect(async () => {
      await encryptData(encryptDataInput.jwt, encryptDataInput.userId);
    }).rejects.toThrowError("SomeKMSError");
  });
});
