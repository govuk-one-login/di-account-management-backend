import { getAisStatus } from "../account-interventions-service-client.js";
import { Guard } from "../process-config.js";

export const hasAisBlockIntervention: Guard = async (commonSubjectId) => {
  const aisStatus = await getAisStatus(commonSubjectId);
  return { continue: !aisStatus.state.blocked, guardName: "AIS" };
};
