import { KmsKeyringNode, buildDecrypt } from "@aws-crypto/client-node";
import buildKmsKeyring from "./kms-keyring-builder";

const MAX_ENCRYPTED_DATA_KEY = 5;
const DECODING = "utf8";

const decryptClientConfig = { maxEncryptedDataKeys: MAX_ENCRYPTED_DATA_KEY };
const decryptClient = buildDecrypt(decryptClientConfig);

let keyring: KmsKeyringNode;

async function decryptData(data: string): Promise<string> {
  try {
    keyring ??= await buildKmsKeyring();
    const result = await decryptClient.decrypt(keyring, data);
    return result.plaintext.toString(DECODING);
  } catch (error) {
    console.error("Failed to decrypt data.", { error });
    throw error;
  }
}

export default decryptData;
