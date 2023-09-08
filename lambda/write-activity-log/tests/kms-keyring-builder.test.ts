import { KmsKeyringNode } from "@aws-crypto/client-node"
import buildKmsKeyring from "../kms-keyring-builder"

const exampleArn: string = "arn:aws:kms:eu-west-2:111122223333:key/bc436485-5092-42b8-92a3-0aa8b93536dc";

describe.only("kmsKeyringBuilder", () => {
  test("construct KmsKeyring corretly", async () => {
    const kmsKeyring: KmsKeyringNode = await buildKmsKeyring(
      exampleArn, exampleArn, exampleArn
    )
    expect(kmsKeyring.keyIds).toHaveLength(2);
    expect(kmsKeyring.generatorKeyId).toEqual(exampleArn);
    expect(kmsKeyring.keyIds[0]).toEqual(exampleArn);
  })


  test("throws error when generator key is not valid ARN", async () => {
    await expect(async () => {
      const kmsKeyring: KmsKeyringNode = await buildKmsKeyring(
        "not-valid-arn", exampleArn
      )
    }).rejects.toThrowError("ARN for envelope encryption Generator key is invalid.");
  })

  test("throws error when wrapper key is not valid ARN", async () => {
    await expect(async () => {
      const kmsKeyring: KmsKeyringNode = await buildKmsKeyring(
        exampleArn, "not-valid-arn", exampleArn
      )
    }).rejects.toThrowError("ARN for main envelope encryption wrapping key is invalid.");
  })

  test("throws error when wrapper key is not defined", async () => {
    await expect(async () => {
      const kmsKeyring: KmsKeyringNode = await buildKmsKeyring(
        exampleArn, undefined, exampleArn
      )
    }).rejects.toThrowError("ARN for main envelope encryption wrapping key is undefined.");
  })
})