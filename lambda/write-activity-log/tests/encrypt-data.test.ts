import { mockClient } from "aws-sdk-client-mock";
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { buildEncrypt, MessageHeader } from "@aws-crypto/client-node";
import { encryptData } from "../encrypt-data";
import { TEST_ACTIVITY_LOG_ENTRY } from "./test-helpers";

const mockedSecretsManager = mockClient(SecretsManagerClient).on(
  GetSecretValueCommand
);

jest.mock("@aws-crypto/client-node", () => ({
  __esModule: true,
  buildEncrypt: jest.fn(() => ({
    encrypt: jest.fn(() => {
      return {
        result: Buffer.from("testEncryptedDataString"),
        messageHeader: {} as MessageHeader,
      };
    }),
  })),
}));

describe("encryptData", () => {
  let encryptDataInput: any;
  beforeEach(() => {
    const activityLogEntry = JSON.stringify(TEST_ACTIVITY_LOG_ENTRY);

    encryptDataInput = {
      activityLogData: activityLogEntry,
      userId: "test_user_123",
    };

    process.env.GENERATOR_KEY_ARN =
      "arn:aws:kms:eu-west-2:111122223333:key/bc436485-5092-42b8-92a3-0aa8b93536dc";
    process.env.VERIFY_ACCESS_PARAM_NAME = "access-param-test-value";
    process.env.ACCOUNT_ID = "12345";
    process.env.AWS_REGION = "GLOBAL";
    process.env.ENVIRONMENT = "dev";
    process.env.WRAPPING_KEY_ARN = "wrapping-key";
    process.env.BACKUP_WRAPPER_KEY_ARN = "backup-wrapping-key";
  });

  it("should return the encryption result Base64 encoded", async () => {
    mockedSecretsManager.resolves({
      SecretString: "testSecretValue",
    });

    const result = await encryptData(
      encryptDataInput.activityLogData,
      encryptDataInput.userId
    );
    expect(result).toEqual("dGVzdEVuY3J5cHRlZERhdGFTdHJpbmc="); // expect fail
    expect(buildEncrypt).toHaveBeenCalled();
    expect(buildEncrypt().encrypt).toHaveBeenCalledWith(
      {
        generatorKeyId:
          "arn:aws:kms:eu-west-2:111122223333:key/bc436485-5092-42b8-92a3-0aa8b93536dc",
      }, // incorrect
      "eyJhbGciOiJIUzI1NiIs9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6jM5M.SflKxwRJSMeKKF2QT4f_adQssw5c",
      {
        encryptionContext: {
          accountId: process.env.ACCOUNT_ID,
          origin: process.env.AWS_REGION,
          accessCheckValue:
            "a393a60804eeb859d0f2d938c530b352b826583b9d648b95a8acdc6e75da85e4",
          stage: process.env.ENVIRONMENT,
          userId: "test_user_123",
        },
      }
    );
  });
});
