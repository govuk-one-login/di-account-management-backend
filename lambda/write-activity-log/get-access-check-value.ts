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
const getHashedAccessCheckValue = async (
  accessCheckValue: string
): Promise<string> => {
  return crypto
    .createHash(SecretValueAlgorithm)
    .update(accessCheckValue)
    .digest(SecretValueEncoding);
};

export default getHashedAccessCheckValue;
