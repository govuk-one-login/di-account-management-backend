import { KmsKeyringNode } from "@aws-crypto/client-node";
import buildKmsKeyring from "../kms-keyring-builder";
import { exampleArn } from "./testFixtures";

describe("kmsKeyringBuilder", () => {
  /* 
  Test order is important as once the wrapping keys have been validated 
  buildKmsKeyring will not do so again.
  */

  test("throws error when wrapper key is not valid ARN", async () => {
    await expect(async () => {
      await buildKmsKeyring(exampleArn, "not-valid-arn", exampleArn);
    }).rejects.toThrow(
      "Invalid configuration - ARN for main envelope encryption wrapping key is invalid."
    );
  });

  test("throws error when wrapper key is not defined", async () => {
    await expect(async () => {
      await buildKmsKeyring(exampleArn, undefined, exampleArn);
    }).rejects.toThrow(
      "Invalid configuration - ARN for main envelope encryption wrapping key is undefined."
    );
  });

  test("throws error when generator key is not present", async () => {
    await expect(async () => {
      await buildKmsKeyring(undefined, exampleArn, exampleArn);
    }).rejects.toThrow(
      "Invalid configuration - ARN for envelope encryption Generator key is undefined"
    );
  });

  test("throws error when generator key is not valid ARN", async () => {
    await expect(async () => {
      await buildKmsKeyring("not-valid-arn", exampleArn, exampleArn);
    }).rejects.toThrow(
      "Invalid configuration - ARN for envelope encryption Generator key is invalid."
    );
  });

  test("construct KmsKeyring corretly", async () => {
    const kmsKeyring: KmsKeyringNode = await buildKmsKeyring(
      exampleArn,
      exampleArn,
      exampleArn
    );
    expect(kmsKeyring.keyIds).toHaveLength(2);
    expect(kmsKeyring.generatorKeyId).toEqual(exampleArn);
    expect(kmsKeyring.keyIds[0]).toEqual(exampleArn);
  });
});
