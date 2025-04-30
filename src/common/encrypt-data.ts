import { KmsKeyringNode, buildEncrypt } from "@aws-crypto/client-node";
import buildKmsKeyring from "./kms-keyring-builder";
import getHashedAccessCheckValue from "./get-access-check-value";
import { getEnvironmentVariable } from "./utils";
import { Logger } from "@aws-lambda-powertools/logger";

const MAX_ENCRYPTED_DATA_KEY = 5;
const ENCODING = "base64";
const GENERATOR_KEY_ARN = getEnvironmentVariable("GENERATOR_KEY_ARN");
const WRAPPING_KEY_ARN = getEnvironmentVariable("WRAPPING_KEY_ARN");
const BACKUP_WRAPPING_KEY_ARN = getEnvironmentVariable(
  "BACKUP_WRAPPING_KEY_ARN"
);
const VERIFY_ACCESS_VALUE = getEnvironmentVariable("VERIFY_ACCESS_VALUE");
const AWS_REGION = getEnvironmentVariable("AWS_REGION");
const ACCOUNT_ID = getEnvironmentVariable("ACCOUNT_ID");
const ENVIRONMENT = getEnvironmentVariable("ENVIRONMENT");
let kmsKeyring: KmsKeyringNode | undefined = undefined;
const encryptClientConfig = { maxEncryptedDataKeys: MAX_ENCRYPTED_DATA_KEY };
const encryptClient = buildEncrypt(encryptClientConfig);
let accessCheckValue: string;
const logger = new Logger();

const initializeEncryptionResources = async () => {
  kmsKeyring ??= await buildKmsKeyring(
    GENERATOR_KEY_ARN,
    WRAPPING_KEY_ARN,
    BACKUP_WRAPPING_KEY_ARN
  );
  if (!accessCheckValue) {
    try {
      accessCheckValue = await getHashedAccessCheckValue(VERIFY_ACCESS_VALUE);
    } catch (error) {
      logger.error("Unable to obtain Access Verification value.");
      throw error;
    }
  }
};

export const encryptData = async (
  toEncrypt: string,
  userId: string
): Promise<string> => {
  await initializeEncryptionResources();

  const encryptionContext = {
    origin: AWS_REGION,
    accountId: ACCOUNT_ID,
    stage: ENVIRONMENT,
    userId,
    accessCheckValue,
  };

  try {
    const { result } = await encryptClient.encrypt(kmsKeyring!, toEncrypt, {
      encryptionContext,
    });
    return result.toString(ENCODING);
  } catch (error: unknown) {
    logger.error("Failed to encrypt data.", { error });
    throw error;
  }
};

export default encryptData;
