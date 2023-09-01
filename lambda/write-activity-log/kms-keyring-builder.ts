import { KmsKeyringNode } from "@aws-crypto/client-node";

interface KMSKeyRingConfig {
  generatorKeyId?: string;
  keyIds: string[];
}

const AWS_ARN_PREFIX = "^arn:aws:";
const RegexpKMSKeyArn = new RegExp(
  `${AWS_ARN_PREFIX}kms:\\w+(?:-\\w+)+:\\d{12}:key\\/[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+$`
);

let kmsKeyRingConfig: KMSKeyRingConfig;

async function formWrappingKeysArray(
  wrappingKeyArn?: string,
  backupWrappingKeyArn?: string
): Promise<string[]> {
  if (!wrappingKeyArn) {
    console.error(
      `Invalid configuration - ARN for Core Wrapping key is undefined.`
    );
    throw new TypeError("ARN for Core Wrapping key is undefined.");
  }

  if (!RegexpKMSKeyArn.test(wrappingKeyArn)) {
    console.error(
      `Invalid configuration - ARN for Core Wrapping key is invalid.`
    );
    throw new TypeError("ARN for Core Wrapping key is invalid.");
  }

  if (!backupWrappingKeyArn) {
    console.error(
      `Invalid configuration - The balckup key arn is undefined or empty.`
    );
    throw new TypeError(
      "The value held in SSM parameter is undefined or empty."
    );
  }

  if (!RegexpKMSKeyArn.test(backupWrappingKeyArn)) {
    console.error(
      `Invalid configuration - ARN for Backup Wrapping key is invalid, update value.`
    );
    throw new TypeError("ARN for Backup Wrapping key is invalid.");
  }

  return [wrappingKeyArn, backupWrappingKeyArn];
}

const buildKmsKeyring = async (
  generatorKeyArn?: string,
  wrappingKeyArn?: string,
  backupWrappingKeyArn?: string
): Promise<KmsKeyringNode> => {
  if (!kmsKeyRingConfig || Object.keys(kmsKeyRingConfig).length === 0) {
    kmsKeyRingConfig = {
      keyIds: await formWrappingKeysArray(wrappingKeyArn, backupWrappingKeyArn),
    };
  }

  if (generatorKeyArn) {
    if (!RegexpKMSKeyArn.test(generatorKeyArn)) {
      console.error(`INVALID_KMS_KEY_ARN ARN for Generator key is invalid.`);
      throw new TypeError("ARN for Generator key is invalid.");
    }
    kmsKeyRingConfig.generatorKeyId = generatorKeyArn;
  }

  return new KmsKeyringNode(kmsKeyRingConfig);
};

export default buildKmsKeyring;
