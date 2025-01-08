import buildKmsKeyring from "../../common/kms-keyring-builder";
import { exampleArn } from "../testFixtures";

describe("kmsKeyringBuilder", () => {
  /* 
  Test order is important as once the wrapping keys have been validated 
  buildKmsKeyring will not do so again.
  */

  test("throws error when generator key is not present", async () => {
    await expect(async () => {
      await buildKmsKeyring(undefined, exampleArn, exampleArn);
    }).rejects.toThrowError(
      "Invalid configuration - ARN for envelope encryption Generator key is undefined"
    );
  });
});
