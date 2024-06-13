import { KmsKeyringNode } from "@aws-crypto/client-node";

export interface KMSKeyRingConfig {
  generatorKeyId?: string;
  keyIds: string[];
}

let kmsKeyRingConfig: KMSKeyRingConfig;

async function formWrappingKeysArray(
  wrappingKeyArn?: string,
  backupWrappingKeyArn?: string,
): Promise<string[]> {
  if (!wrappingKeyArn) {
    throw new TypeError(
      "Invalid configuration - ARN for main envelope encryption wrapping key is undefined.",
    );
  }
  if (backupWrappingKeyArn) {
    return [wrappingKeyArn, backupWrappingKeyArn];
  }

  return [wrappingKeyArn];
}

const buildKmsKeyring = async (
  generatorKeyArn?: string,
  wrappingKeyArn?: string,
  backupWrappingKeyArn?: string,
): Promise<KmsKeyringNode> => {
  if (!kmsKeyRingConfig || Object.keys(kmsKeyRingConfig).length === 0) {
    if (backupWrappingKeyArn) {
      kmsKeyRingConfig = {
        keyIds: await formWrappingKeysArray(
          wrappingKeyArn,
          backupWrappingKeyArn,
        ),
      };
    } else {
      kmsKeyRingConfig = {
        keyIds: await formWrappingKeysArray(wrappingKeyArn),
      };
    }
  }
  if (generatorKeyArn) {
    kmsKeyRingConfig.generatorKeyId = generatorKeyArn;
    return new KmsKeyringNode(kmsKeyRingConfig);
  }
  throw new TypeError(
    "Invalid configuration - ARN for envelope encryption Generator key is undefined",
  );
};

export default buildKmsKeyring;
