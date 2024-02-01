import { KmsKeyringNode } from "@aws-crypto/client-node";

export interface KMSKeyRingConfig {
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
    throw new TypeError(
      "Invalid configuration - ARN for main envelope encryption wrapping key is undefined."
    );
  }
  if (!RegexpKMSKeyArn.test(wrappingKeyArn)) {
    throw new TypeError(
      "Invalid configuration - ARN for main envelope encryption wrapping key is invalid."
    );
  }
  if (!backupWrappingKeyArn) {
    throw new TypeError(
      "Invalid configuration - ARN for backup envelope encryption key arn is undefined."
    );
  }
  if (!RegexpKMSKeyArn.test(backupWrappingKeyArn)) {
    throw new TypeError(
      "Invalid configuration - ARN for Backup Wrapping key is invalid, update value."
    );
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
      throw new TypeError(
        "Invalid configuration - ARN for envelope encryption Generator key is invalid."
      );
    }
    kmsKeyRingConfig.generatorKeyId = generatorKeyArn;
    return new KmsKeyringNode(kmsKeyRingConfig);
  }
  throw new TypeError(
    "Invalid configuration - ARN for envelope encryption Generator key is undefined"
  );
};

export default buildKmsKeyring;
