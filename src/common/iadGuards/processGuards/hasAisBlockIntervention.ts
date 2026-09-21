import { isUserIdBlocked } from "../../account-interventions-service-client.js";
import { Guard } from "../../process-config.js";
import assert from "node:assert";

export const hasAisBlockIntervention: Guard = async (commonSubjectId) => {
  assert.ok(
    commonSubjectId,
    "the 'hasAisBlockIntervention' guard requires a valid commonSubjectId"
  );
  const guardActivated = await isUserIdBlocked(commonSubjectId);
  return { guardActivated, guardName: "AIS" };
};
