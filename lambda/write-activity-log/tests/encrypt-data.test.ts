import { mockClient } from "aws-sdk-client-mock";
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { buildEncrypt, MessageHeader } from "@aws-crypto/client-node";
import { when } from "jest-when";
import { encryptData } from "../encrypt-data";
import { TEST_ACTIVITY_LOG_ENTRY } from "./test-helpers";

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
      encryptDataInput.activityLogData,
      encryptDataInput.userId
    );
    expect(result).toEqual("dGVzdEVuY3J5cHRlZERhdGFTdHJpbmc=");
    expect(buildEncrypt).toHaveBeenCalled();
    expect(buildEncrypt().encrypt).toHaveBeenCalledWith(
      {
        generatorKeyId:
          "arn:aws:kms:eu-west-2:111122223333:key/bc436485-5092-42b8-92a3-0aa8b93536dc",
      },
      encryptDataInput.activityLogData,
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
