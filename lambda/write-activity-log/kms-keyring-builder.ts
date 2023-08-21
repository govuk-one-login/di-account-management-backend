import { KmsKeyringNode } from '@aws-crypto/client-node';

interface KMSKeyRingConfig {
  generatorKeyId?: string;
  keyIds: string[];
}

const AWS_ARN_PREFIX = '^arn:aws:';
const RegexpKMSKeyArn = new RegExp(
  `${AWS_ARN_PREFIX}kms:\\w+(?:-\\w+)+:\\d{12}:key\\/[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+$`,
);

let kmsKeyRingConfig: KMSKeyRingConfig;

export async function buildKmsKeyring(generatorKeyId?: string): Promise<KmsKeyringNode> {
  if(!kmsKeyRingConfig || Object.keys(kmsKeyRingConfig).length === 0) {
    kmsKeyRingConfig = { keyIds: await formWrappingKeysArray() };
  }

  if (generatorKeyId) {
    if (!RegexpKMSKeyArn.test(generatorKeyId)) {
      console.error(`INVALID_KMS_KEY_ARN ARN for Generator key is invalid.`);
      throw new TypeError('ARN for Generator key is invalid.');
    }
    kmsKeyRingConfig.generatorKeyId = generatorKeyId;
  }

  return new KmsKeyringNode(kmsKeyRingConfig);
}

async function formWrappingKeysArray(): Promise<string[]> {
  let backupWrappingKeyARN: string | undefined;
  try {
    backupWrappingKeyARN = await getParameter(appConfig.backupWrappingKeyParamName, {
      maxAge: 900,
    });
  } catch (error: unknown) {
    logger.error(
      `Invalid configuration - Failed to get ARN for Backup Wrapping key held in SSM param (${appConfig.backupWrappingKeyParamName}).`,
      { error },
    );
    logAndPublishMetric(MetricNames.UNOBTAINABLE_CONFIG_PARAMETER, [
      { key: 'key', value: 'Backup Wrapping Key' },
      { key: 'name', value: appConfig.backupWrappingKeyParamName },
    ]);
    throw new TypeError('Failed to get ARN for Backup Wrapping.');
  }
  checkBackupWrappingKeyArn(backupWrappingKeyARN);
  const coreWrappingKeyARN = appConfig.wrappingKeyArn;
  checkCoreWrapperKeyArn(coreWrappingKeyARN);
  return [coreWrappingKeyARN, backupWrappingKeyARN!];
}

function checkBackupWrappingKeyArn(backupWrappingKeyARN: string | undefined) {
  if (!backupWrappingKeyARN) {
    console.error(
      `Invalid configuration - The value held in SSM param (${appConfig.backupWrappingKeyParamName}) is undefined or empty.`,
    );
    throw new TypeError('The value held in SSM parameter is undefined or empty.');
  }

  if (!RegexpKMSKeyArn.test(backupWrappingKeyARN)) {
    console.error(
      `Invalid configuration - ARN for Backup Wrapping key is invalid, update value held in SSM param (${appConfig.backupWrappingKeyParamName}).`,
    );
    throw new TypeError('ARN for Backup Wrapping key is invalid.');
  }
}

function checkCoreWrapperKeyArn(coreWrappingKeyARN: string) {
  if (!RegexpKMSKeyArn.test(coreWrappingKeyARN)) {
    console.error(`Invalid configuration - ARN for Core Wrapping key is invalid.`);
    throw new TypeError('ARN for Core Wrapping key is invalid.');
  }
}