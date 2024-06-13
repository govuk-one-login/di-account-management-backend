import {
  EncryptionContext,
  KmsKeyringNode,
  buildDecrypt,
} from "@aws-crypto/client-node";
import buildKmsKeyring from "./common/kms-keyring-builder";
import getHashedAccessCheckValue from "./common/get-access-check-value";

const MAX_ENCRYPTED_DATA_KEY = 5;
const DECODING = "utf8";
const ENCODING = "base64";

const decryptClientConfig = { maxEncryptedDataKeys: MAX_ENCRYPTED_DATA_KEY };
const decryptClient = buildDecrypt(decryptClientConfig);

let keyring: KmsKeyringNode;

export async function generateExpectedContext(
  userId: string,
): Promise<EncryptionContext> {
  const { AWS_REGION, ACCOUNT_ID, ENVIRONMENT, VERIFY_ACCESS_VALUE } =
    process.env;
  if (AWS_REGION === undefined) {
    throw new Error("Missing AWS_REGION environment variable");
  }

  if (ACCOUNT_ID === undefined) {
    throw new Error("Missing ACCOUNT_ID environment variable");
  }

  if (ENVIRONMENT === undefined) {
    throw new Error("Missing ENVIRONMENT environment variable");
  }

  if (VERIFY_ACCESS_VALUE === undefined) {
    throw new Error("Missing VERIFY_ACCESS_VALUE environment variable");
  }

  let accessCheckValue;
  try {
    accessCheckValue = await getHashedAccessCheckValue(VERIFY_ACCESS_VALUE);
  } catch (error) {
    console.error("Unable to obtain Access Verification value.");
    throw error;
  }

  return {
    origin: AWS_REGION,
    accountId: ACCOUNT_ID,
    stage: ENVIRONMENT,
    userId,
    accessCheckValue: accessCheckValue,
  };
}

export function validateEncryptionContext(
  context: EncryptionContext,
  expected: EncryptionContext,
): void {
  if (context === undefined || Object.keys(context).length === 0) {
    throw new Error("Encryption context is empty or undefined");
  }

  Object.keys(expected).forEach((key) => {
    if (context[key] !== expected[key]) {
      throw new Error(`Encryption context mismatch: ${key}`);
    }
  });
}

export async function decryptData(
  data: string,
  userId: string,
  generatorKeyArn: string,
  wrappingKeyArn: string,
): Promise<string> {
  try {
    keyring ??= await buildKmsKeyring(generatorKeyArn, wrappingKeyArn);
    const result = await decryptClient.decrypt(
      keyring,
      Buffer.from(data, ENCODING),
    );
    const expectedEncryptionContext = await generateExpectedContext(userId);
    validateEncryptionContext(
      result.messageHeader.encryptionContext,
      expectedEncryptionContext,
    );
    return result.plaintext.toString(DECODING);
  } catch (error) {
    console.error("Failed to decrypt data.", { error });
    throw error;
  }
}
