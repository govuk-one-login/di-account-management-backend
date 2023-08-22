import { KmsKeyringNode } from "@aws-crypto/client-node";
import { getParameter } from "@aws-lambda-powertools/parameters/ssm";

interface KMSKeyRingConfig {
  generatorKeyId?: string;
  keyIds: string[];
}

const { BACKUP_WRAPPER_KEY_ARN } = process.env;
const { WRAPPING_KEY_ARN } = process.env;

const AWS_ARN_PREFIX = "^arn:aws:";
const RegexpKMSKeyArn = new RegExp(
  `${AWS_ARN_PREFIX}kms:\\w+(?:-\\w+)+:\\d{12}:key\\/[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+$`
);

let kmsKeyRingConfig: KMSKeyRingConfig;

export async function buildKmsKeyring(
  generatorKeyId?: string
): Promise<KmsKeyringNode> {
  if (!kmsKeyRingConfig || Object.keys(kmsKeyRingConfig).length === 0) {
    kmsKeyRingConfig = { keyIds: await formWrappingKeysArray() };
  }

  if (generatorKeyId) {
    if (!RegexpKMSKeyArn.test(generatorKeyId)) {
      console.error(`INVALID_KMS_KEY_ARN ARN for Generator key is invalid.`);
      throw new TypeError("ARN for Generator key is invalid.");
    }
    kmsKeyRingConfig.generatorKeyId = generatorKeyId;
  }

  return new KmsKeyringNode(kmsKeyRingConfig);
}

async function formWrappingKeysArray(): Promise<string[]> {

  if (!WRAPPING_KEY_ARN) {
    console.error(
      `Invalid configuration - ARN for Core Wrapping key is undefined.`
    );
    throw new TypeError("ARN for Core Wrapping key is undefined.");
  }

  if (!RegexpKMSKeyArn.test(WRAPPING_KEY_ARN)) {
    console.error(
      `Invalid configuration - ARN for Core Wrapping key is invalid.`
    );
    throw new TypeError("ARN for Core Wrapping key is invalid.");
  }

  if (!BACKUP_WRAPPER_KEY_ARN) {
    console.error(
      `Invalid configuration - The balckup key arn held in SSM param is undefined or empty.`
    );
    throw new TypeError(
      "The value held in SSM parameter is undefined or empty."
    );
  }

  if (!RegexpKMSKeyArn.test(BACKUP_WRAPPER_KEY_ARN)) {
    console.error(
      `Invalid configuration - ARN for Backup Wrapping key is invalid, update value held in SSM param.`
    );
    throw new TypeError("ARN for Backup Wrapping key is invalid.");
  }

  return [WRAPPING_KEY_ARN, BACKUP_WRAPPER_KEY_ARN];
}

