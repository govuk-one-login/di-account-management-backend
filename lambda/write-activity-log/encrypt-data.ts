import { KmsKeyringNode, buildEncrypt } from '@aws-crypto/client-node';
import { getHashedAccessCheckValue } from '../commons/get-hashed-access-check-value';
import { AppConfigService } from './app-config-service';
import { ENCODING, MetricNames } from '../data-types/constants';
import logger from '../commons/logger';

import { logAndPublishMetric } from '../commons/metrics';
import { buildKmsKeyring } from './kms-keyring-builder';

const MAX_ENCRYPTED_DATA_KEY : number = Number(String(process.env.MAX_ENCRYPTED_DATA_KEY));
const { GENERATOR_KEY_ARN } = process.env;
const { VERIFY_ACCESS_PARAM_NAME } = process.env;
const { AWS_REGION } = process.env;
const { ACCOUNT_ID } = process.env;
const { ENVIRONMENT } = process.env;

let kmsKeyring: KmsKeyringNode;
const encryptClientConfig = { maxEncryptedDataKeys: MAX_ENCRYPTED_DATA_KEY };
let encryptClient = buildEncrypt(encryptClientConfig);


export async function encryptData(dataToEncrypt: string, userId: string): Promise<string> {

  checkEnvironmentVariableExists(GENERATOR_KEY_ARN,VERIFY_ACCESS_PARAM_NAME, AWS_REGION, ACCOUNT_ID, ENVIRONMENT);

  kmsKeyring ??= await buildKmsKeyring(GENERATOR_KEY_ARN);
  encryptClient ??= buildEncrypt(encryptClientConfig);
  const { encrypt } = encryptClient;

  let accessCheckValue;
  try {
    accessCheckValue = await getHashedAccessCheckValue(VERIFY_ACCESS_PARAM_NAME);
  } catch (error) {
    logger.error('Unable to obtain Access Verification value.');
    throw error;
  }

  // if (
  //   AWS_REGION !== undefined &&
  //   ACCOUNT_ID !== undefined &&
  //   ENVIRONMENT !== undefined
  // ) {
    const encryptionContext: EncryptionContext = {
      origin: AWS_REGION,
      accountId: ACCOUNT_ID,
      stage: ENVIRONMENT,
      userId,
      accessCheckValue,
    };

    try {
      const { result } = await encrypt(kmsKeyring, dataToEncrypt, {encryptionContext});
      return result.toString(ENCODING);
    } catch (error: unknown) {
      logger.error('Failed to encrypt data.', { error });
      logAndPublishMetric(MetricNames.ENCRYPTION_FAILED);
      throw error;
    }
  }

  
// }

export function checkEnvironmentVariableExists(...valuesToCheck: Array<(string | undefined )>) {
  const notPresentValues = valuesToCheck.filter(function (value) {
    return value === "undefined";
  })
  if (notPresentValues.length > 0) {
    throw new Error(
      `an environment variable is not present`
    )    
  }
}

interface EncryptionContext {
  origin: string;
  accountId: string;
  stage: string;
  userId: string;
  accessCheckValue: string;
}