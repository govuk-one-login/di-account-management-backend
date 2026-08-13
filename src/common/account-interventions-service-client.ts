import axios from "axios";
import { Logger } from "@aws-lambda-powertools/logger";
import * as v from "valibot";
import { getEnvironmentVariable } from "./utils.js";

const logger = new Logger();

const AccountStateSchema = v.object({
  blocked: v.boolean(),
  suspended: v.boolean(),
  reproveIdentity: v.boolean(),
  resetPassword: v.boolean(),
});

const InterventionStatusResponseSchema = v.object({
  state: AccountStateSchema,
});

export type InterventionStatusResponse = v.InferOutput<
  typeof InterventionStatusResponseSchema
>;

export const getAisStatus = async (
  userId: string
): Promise<InterventionStatusResponse> => {
  const baseUrl = getEnvironmentVariable(
    "ACCOUNT_INTERVENTIONS_SERVICE_API_URL"
  );

  logger.info("Fetching AIS status", { userId });

  const response = await axios.get(`${baseUrl}/ais/${userId}`, {
    headers: {
      "Content-Type": "application/json",
    },
    timeout: 10000,
  });

  const parsed = v.safeParse(InterventionStatusResponseSchema, response.data);

  if (!parsed.success) {
    logger.error("Invalid response from Account Interventions Service", {
      userId
    });
    throw new Error(
      "Invalid response from Account Interventions Service API"
    );
  }

  logger.info("Successfully fetched AIS status", { userId });
  return parsed.output;
};
