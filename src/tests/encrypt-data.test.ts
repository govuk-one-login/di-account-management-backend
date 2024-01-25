import { mockClient } from "aws-sdk-client-mock";
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { buildEncrypt, MessageHeader } from "@aws-crypto/client-node";
import { when } from "jest-when";
import encryptData from "../common/encrypt-data";
import { TEST_ACTIVITY_LOG_ENTRY } from "./testFixtures";

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
