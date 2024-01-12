import { KmsKeyringNode, buildEncrypt } from "@aws-crypto/client-node";
import buildKmsKeyring from "./kms-keyring-builder";
import getHashedAccessCheckValue from "./get-access-check-value";

const MAX_ENCRYPTED_DATA_KEY = 5;
const ENCODING = "base64";

let kmsKeyring: KmsKeyringNode;
const encryptClientConfig = { maxEncryptedDataKeys: MAX_ENCRYPTED_DATA_KEY };
let encryptClient = buildEncrypt(encryptClientConfig);

const encryptData = async (
  toEncrypt: string,
  userId: string
): Promise<string> => {
  const { GENERATOR_KEY_ARN } = process.env;
  const { WRAPPING_KEY_ARN } = process.env;
  const { BACKUP_WRAPPING_KEY_ARN } = process.env;
  const { VERIFY_ACCESS_VALUE } = process.env;
  const { AWS_REGION } = process.env;
  const { ACCOUNT_ID } = process.env;
  const { ENVIRONMENT } = process.env;
  console.time("buildKmsKeyring");
  kmsKeyring ??= await buildKmsKeyring(
    GENERATOR_KEY_ARN,
    WRAPPING_KEY_ARN,
    BACKUP_WRAPPING_KEY_ARN
  );
  console.timeEnd("buildKmsKeyring");
  console.time("buildEncrypt");
  encryptClient ??= buildEncrypt(encryptClientConfig);
  console.timeEnd("buildEncrypt");
  const { encrypt } = encryptClient;

  if (
    VERIFY_ACCESS_VALUE !== undefined &&
    AWS_REGION !== undefined &&
    ACCOUNT_ID !== undefined &&
    ENVIRONMENT !== undefined
  ) {
    let accessCheckValue;
    try {
      console.time("getHashedAccessCheckValue");
      accessCheckValue = await getHashedAccessCheckValue(VERIFY_ACCESS_VALUE);
      console.timeEnd("getHashedAccessCheckValue");
    } catch (error) {
      console.error("Unable to obtain Access Verification value.");
      throw error;
    }
    const encryptionContext = {
      origin: AWS_REGION,
      accountId: ACCOUNT_ID,
      stage: ENVIRONMENT,
      userId,
      accessCheckValue,
    };
    try {
      console.time(" carry out encrypt");
      const { result } = await encrypt(kmsKeyring, toEncrypt, {
        encryptionContext,
      });
      console.timeEnd("carry out encrypt");
      const response = result.toString(ENCODING);
      return response;
    } catch (error: unknown) {
      console.error("Failed to encrypt data.", { error });
      throw error;
    }
  }
  throw new Error(`an environment variable is not present`);
};

export default encryptData;
