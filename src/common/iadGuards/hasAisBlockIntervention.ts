import { getAisStatus } from "../account-interventions-service-client.js";
import { Guard, Actions } from "../process-config.js";
import assert from "node:assert";

export const hasAisBlockIntervention: Guard = async (commonSubjectId) => {
  assert(commonSubjectId, "the 'hasAisBlockIntervention' guard requires a valid commonSubjectId");
  const aisStatus = await getAisStatus(commonSubjectId);
  const continueAction = aisStatus.state.blocked ? Actions.abort : Actions.continue;
  return { continue: continueAction, guardName: "AIS" };
};
