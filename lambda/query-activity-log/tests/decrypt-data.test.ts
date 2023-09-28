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
    generatorKeyId: process.env.GENERATOR_KEY_ARN,
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

  test("throws an error when AWS_REGION is not defined", () => {
    delete process.env.AWS_REGION;
    expect(() => {
      generateExpectedContext(userId);
    }).toThrowError("Missing AWS_REGION environment variable");
  });

  test("throws an error when ACCOUNT_ID is not defined", () => {
    delete process.env.ACCOUNT_ID;
    expect(() => {
      generateExpectedContext(userId);
    }).toThrowError("Missing ACCOUNT_ID environment variable");
  });

  test("throws an error when ENVIRONMENT is not defined", () => {
    delete process.env.ENVIRONMENT;
    expect(() => {
      generateExpectedContext(userId);
    }).toThrowError("Missing ENVIRONMENT environment variable");
  });

  test("throws an error when VERIFY_ACCESS_VALUE is not defined", () => {
    delete process.env.VERIFY_ACCESS_VALUE;
    expect(() => {
      generateExpectedContext(userId);
    }).toThrowError("Missing VERIFY_ACCESS_VALUE environment variable");
  });

  test("returns the encryption context", () => {
    const result = generateExpectedContext(userId);
    const expected = {
      origin: awsRegion,
      accountId,
      stage: environment,
      userId,
      accessCheckValue,
    };
    expect(result).toEqual(expected);
  });
});

describe("validateEncryptionContext", () => {
  let expected: EncryptionContext;
  beforeEach(() => {
    process.env.AWS_REGION = awsRegion;
    process.env.ACCOUNT_ID = accountId;
    process.env.ENVIRONMENT = environment;
    process.env.VERIFY_ACCESS_VALUE = accessCheckValue;
    expected = generateExpectedContext(userId);
  });

  test("throws an error when the context is empty", () => {
    expect(() => {
      validateEncryptionContext({}, expected);
    }).toThrowError("Encryption context is empty or undefined");
  });

  test("throws an error when there is a mismatch", () => {
    const wrongContext = {
      origin: awsRegion,
      accountId,
      stage: environment,
      userId: "wrong-user-id",
      accessCheckValue,
    };
    expect(() => {
      validateEncryptionContext(wrongContext, expected);
    }).toThrowError("Encryption context mismatch: userId");
  });

  test("doesn't throw an error when context matches", () => {
    validateEncryptionContext(expected, expected);
  });
});

describe("decryptActivities", () => {
  let encryptedActivities: string;

  beforeEach(() => {
    encryptedActivities = "an-encrypted-string";

    process.env.GENERATOR_KEY_ARN =
      "arn:aws:kms:eu-west-2:111122223333:key/bc436485-5092-42b8-92a3-0aa8b93536dc";
    process.env.WRAPPING_KEY_ARN =
      "arn:aws:kms:eu-west-2:111122223333:key/49c5492b-b1bc-42a8-9a5c-b2015e810c1c";
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
          accessCheckValue,
        } as EncryptionContext,
      } as MessageHeader,
    });

    process.env.AWS_REGION = awsRegion;
    process.env.ACCOUNT_ID = accountId;
    process.env.ENVIRONMENT = environment;
    process.env.VERIFY_ACCESS_VALUE = accessCheckValue;

    await decryptData(encryptedActivities, userId);
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
      await decryptData(encryptedActivities, userId);
    }).rejects.toThrowError("A KMS error");
  });
});
