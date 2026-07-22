import { Logger } from "@aws-lambda-powertools/logger";

const logger = new Logger();

interface RetryFunctionOptions {
  retries?: number,
  delay?: number,
  functionName: string
}
export const retryFunction = async <T>(
  fn: () => Promise<T>,
  {
    retries = 3,
    delay = 300,
    functionName
  }: RetryFunctionOptions 
): Promise<T> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      logger.warn(`${functionName} failed (attempt ${attempt} out of ${retries}).`);
      if (attempt === retries) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("Unexpected error");
};

