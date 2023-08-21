import { KmsKeyringNode, buildEncrypt } from "@aws-crypto/client-node";
import { buildKmsKeyring } from "./kms-keyring-builder";
import { getHashedAccessCheckValue } from "./get-access-check-value";

const MAX_ENCRYPTED_DATA_KEY: number = Number(
  String(process.env.MAX_ENCRYPTED_DATA_KEY)
);
const { GENERATOR_KEY_ARN } = process.env;
const { VERIFY_ACCESS_PARAM_NAME } = process.env;
const { AWS_REGION } = process.env;
const { ACCOUNT_ID } = process.env;
const { ENVIRONMENT } = process.env;

const ENCODING = "base64";

let kmsKeyring: KmsKeyringNode;
const encryptClientConfig = { maxEncryptedDataKeys: MAX_ENCRYPTED_DATA_KEY };
let encryptClient = buildEncrypt(encryptClientConfig);

export async function encryptData(
  dataToEncrypt: string,
  userId: string
): Promise<string> {
  kmsKeyring ??= await buildKmsKeyring(GENERATOR_KEY_ARN);
  encryptClient ??= buildEncrypt(encryptClientConfig);
  const { encrypt } = encryptClient;

  if (
    VERIFY_ACCESS_PARAM_NAME !== undefined &&
    AWS_REGION !== undefined &&
    ACCOUNT_ID !== undefined &&
    ENVIRONMENT !== undefined
  ) {
    let accessCheckValue;
    try {
      accessCheckValue = await getHashedAccessCheckValue(
        VERIFY_ACCESS_PARAM_NAME
      );
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
      const { result } = await encrypt(kmsKeyring, dataToEncrypt, {
        encryptionContext,
      });
      return result.toString(ENCODING);
    } catch (error: unknown) {
      console.error("Failed to encrypt data.", { error });
      throw error;
    }
  }

  throw new Error(`an environment variable is not present`);
}
