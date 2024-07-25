import { KmsKeyringNode, buildEncrypt } from "@aws-crypto/client-node";
import buildKmsKeyring from "./kms-keyring-builder";
import getHashedAccessCheckValue from "./get-access-check-value";
import { getEnvironmentVariable } from "./utils";

const MAX_ENCRYPTED_DATA_KEY = 5;
const ENCODING = "base64";

let kmsKeyring: KmsKeyringNode;
const encryptClientConfig = { maxEncryptedDataKeys: MAX_ENCRYPTED_DATA_KEY };
let encryptClient = buildEncrypt(encryptClientConfig);

const encryptData = async (
  toEncrypt: string,
  userId: string
): Promise<string> => {
  const GENERATOR_KEY_ARN = getEnvironmentVariable("GENERATOR_KEY_ARN");
  const WRAPPING_KEY_ARN = getEnvironmentVariable("WRAPPING_KEY_ARN");
  const BACKUP_WRAPPING_KEY_ARN = getEnvironmentVariable(
    "BACKUP_WRAPPING_KEY_ARN"
  );
  const VERIFY_ACCESS_VALUE = getEnvironmentVariable("VERIFY_ACCESS_VALUE");
  const AWS_REGION = getEnvironmentVariable("AWS_REGION");
  const ACCOUNT_ID = getEnvironmentVariable("ACCOUNT_ID");
  const ENVIRONMENT = getEnvironmentVariable("ENVIRONMENT");

  kmsKeyring ??= await buildKmsKeyring(
    GENERATOR_KEY_ARN,
    WRAPPING_KEY_ARN,
    BACKUP_WRAPPING_KEY_ARN
  );
  encryptClient ??= buildEncrypt(encryptClientConfig);
  const { encrypt } = encryptClient;

  let accessCheckValue;
  try {
    accessCheckValue = await getHashedAccessCheckValue(VERIFY_ACCESS_VALUE);
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
    const { result } = await encrypt(kmsKeyring, toEncrypt, {
      encryptionContext,
    });
    const response = result.toString(ENCODING);
    return response;
  } catch (error: unknown) {
    console.error("Failed to encrypt data.", { error });
    throw error;
  }
};

export default encryptData;
