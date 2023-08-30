import crypto from "node:crypto";
import { getSecret } from "@aws-lambda-powertools/parameters/secrets";

const SecretValueAlgorithm = "sha256";
const SecretValueEncoding = "hex";

/**
 * A function for retrieving a secret string value from Secrets Manager.
 *
 * @param secretId - the name of the secret to retrieve
 * @returns the hexadecimal representation of the hashed secret value on promise fulfillment
 * @throws {@link TypeError}
 * Thrown when the secret value is falsy
 */
const getHashedAccessCheckValue = async (secretId: string): Promise<string> => {
  let accessCheckValue: string | undefined;
  try {
    accessCheckValue = await getSecret(secretId, { maxAge: 900 });
  } catch (error: unknown) {
    console.error(
      `Invalid configuration - Failed to get Access Verification value held in SecretsManager (${secretId}).`,
      { error }
    );
    throw new Error("Failed to get Access Verification value.");
  }

  if (!accessCheckValue) {
    console.error(
      `Invalid configuration - The Verifying Access value held in SecretsManager (${secretId}) undefined or empty.`
    );
    throw new TypeError(`The Verifying Access value is invalid or empty.`);
  }
  return crypto
    .createHash(SecretValueAlgorithm)
    .update(accessCheckValue)
    .digest(SecretValueEncoding);
};

export default getHashedAccessCheckValue;
