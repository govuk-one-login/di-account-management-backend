import {
  EncryptionContext,
  MessageHeader,
  buildDecrypt,
} from "@aws-crypto/client-node";
import { when } from "jest-when";

import {
  decryptData,
  generateExpectedContext,
  validateEncryptionContext,
} from "../decrypt-data";

jest.mock("@aws-crypto/client-node", () => ({
  buildDecrypt: jest.fn().mockReturnValue({
    decrypt: jest.fn(),
  }),
  KmsKeyringNode: jest.fn().mockImplementation(() => ({
    generatorKeyId:
      "arn:aws:kms:eu-west-2:111122223333:key/bc436485-5092-42b8-92a3-0aa8b93536dc",
  })),
}));

const awsRegion = "aws-region";
const accountId = "account-id";
const environment = "environment";
const accessCheckValue = "accessCheckValue";
const userId = "user-id";

describe("generateExpectedContext", () => {
  beforeEach(() => {
    process.env.AWS_REGION = awsRegion;
    process.env.ACCOUNT_ID = accountId;
    process.env.ENVIRONMENT = environment;
    process.env.VERIFY_ACCESS_VALUE = accessCheckValue;
  });

  afterEach(() => {
    delete process.env.AWS_REGION;
    delete process.env.ACCOUNT_ID;
    delete process.env.ENVIRONMENT;
    delete process.env.VERIFY_ACCESS_VALUE;
  });

  test("throws an error when AWS_REGION is not defined", async () => {
    delete process.env.AWS_REGION;
    try {
      await generateExpectedContext(userId);
    } catch (error) {
      expect((error as Error).message).toEqual(
        'Environment variable "AWS_REGION" is not set.'
      );
    }
  });

  test("throws an error when ACCOUNT_ID is not defined", async () => {
    delete process.env.ACCOUNT_ID;
    try {
      await generateExpectedContext(userId);
    } catch (error) {
      expect((error as Error).message).toEqual(
        'Environment variable "ACCOUNT_ID" is not set.'
      );
    }
  });

  test("throws an error when ENVIRONMENT is not defined", async () => {
    delete process.env.ENVIRONMENT;
    try {
      await generateExpectedContext(userId);
    } catch (error) {
      expect((error as Error).message).toEqual(
        'Environment variable "ENVIRONMENT" is not set.'
      );
    }
  });

  test("throws an error when VERIFY_ACCESS_VALUE is not defined", async () => {
    delete process.env.VERIFY_ACCESS_VALUE;
    try {
      await generateExpectedContext(userId);
    } catch (error) {
      expect((error as Error).message).toEqual(
        'Environment variable "VERIFY_ACCESS_VALUE" is not set.'
      );
    }
  });

  test("returns the encryption context", async () => {
    const result = await generateExpectedContext(userId);
    const expected = {
      origin: awsRegion,
      accountId,
      stage: environment,
      userId,
      accessCheckValue:
        "a6ece7f2c1c292f31e1cdba0bdeeb4653c25d03e3482394cdfe4e73ae0e42b66",
    };
    expect(result).toEqual(expected);
  });
});

describe("validateEncryptionContext", () => {
  beforeEach(() => {
    process.env.AWS_REGION = awsRegion;
    process.env.ACCOUNT_ID = accountId;
    process.env.ENVIRONMENT = environment;
    process.env.VERIFY_ACCESS_VALUE = accessCheckValue;
  });

  test("throws an error when the context is empty", async () => {
    const expected: EncryptionContext = await generateExpectedContext(userId);
    expect(() => {
      validateEncryptionContext({}, expected);
    }).toThrow("Encryption context is empty or undefined");
  });

  test("throws an error when there is a mismatch", async () => {
    const wrongContext = {
      origin: awsRegion,
      accountId,
      stage: environment,
      userId: "wrong-user-id",
      accessCheckValue,
    };
    const expected: EncryptionContext = await generateExpectedContext(userId);
    expect(() => {
      validateEncryptionContext(wrongContext, expected);
    }).toThrow("Encryption context mismatch: userId");
  });

  test("doesn't throw an error when context matches", async () => {
    const expected: EncryptionContext = await generateExpectedContext(userId);
    validateEncryptionContext(expected, expected);
  });
});

describe("decryptActivities", () => {
  let encryptedActivities: string;
  const generatorKey =
    "arn:aws:kms:eu-west-2:111122223333:key/bc436485-5092-42b8-92a3-0aa8b93536dc";
  const wrappingKey =
    "arn:aws:kms:eu-west-2:111122223333:key/49c5492b-b1bc-42a8-9a5c-b2015e810c1c";

  beforeEach(() => {
    encryptedActivities = "an-encrypted-string";
  });

  it("should decrypt an encrypted string", async () => {
    when(buildDecrypt().decrypt).mockResolvedValue({
      plaintext: Buffer.from(encryptedActivities),
      messageHeader: {
        encryptionContext: {
          origin: awsRegion,
          accountId,
          stage: environment,
          userId,
          accessCheckValue:
            "a6ece7f2c1c292f31e1cdba0bdeeb4653c25d03e3482394cdfe4e73ae0e42b66",
        } as EncryptionContext,
      } as MessageHeader,
    });

    process.env.AWS_REGION = awsRegion;
    process.env.ACCOUNT_ID = accountId;
    process.env.ENVIRONMENT = environment;
    process.env.VERIFY_ACCESS_VALUE = accessCheckValue;

    await decryptData(encryptedActivities, userId, generatorKey, wrappingKey);
    expect(buildDecrypt).toHaveBeenCalled();
    expect(buildDecrypt().decrypt).toHaveBeenCalledWith(
      {
        generatorKeyId:
          "arn:aws:kms:eu-west-2:111122223333:key/bc436485-5092-42b8-92a3-0aa8b93536dc",
      },
      Buffer.from(encryptedActivities, "base64")
    );
  });

  it("should throw an error if something goes wrong when decrypting", () => {
    when(buildDecrypt().decrypt).mockRejectedValue(new Error("A KMS error"));
    expect(async () => {
      await decryptData(encryptedActivities, userId, generatorKey, wrappingKey);
    }).rejects.toThrow("A KMS error");
  });
});
