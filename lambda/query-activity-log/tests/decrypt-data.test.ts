import { MessageHeader, buildDecrypt } from "@aws-crypto/client-node";
import { when } from "jest-when";

import decryptData from "../decrypt-data";

jest.mock("@aws-crypto/client-node", () => ({
  buildDecrypt: jest.fn().mockReturnValue({
    decrypt: jest.fn(),
  }),
  KmsKeyringNode: jest.fn().mockImplementation(() => ({
    generatorKeyId: process.env.GENERATOR_KEY_ARN,
  })),
}));

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
      messageHeader: {} as MessageHeader,
    });

    await decryptData(encryptedActivities);
    expect(buildDecrypt).toHaveBeenCalled();
    expect(buildDecrypt().decrypt).toHaveBeenCalledWith(
      {
        generatorKeyId:
          "arn:aws:kms:eu-west-2:111122223333:key/bc436485-5092-42b8-92a3-0aa8b93536dc",
      },
      encryptedActivities
    );
  });

  it("should throw an error if something goes wrong when decrypting", () => {
    when(buildDecrypt().decrypt).mockRejectedValue(new Error("A KMS error"));
    expect(async () => {
      await decryptData(encryptedActivities);
    }).rejects.toThrowError("A KMS error");
  });
});
