import { Guard, Actions } from "../process-config.js";
import { getEnvironmentVariable } from "../utils.js";

export const sendInactiveAccountEmailsIsEnabled: Guard = async () => {
  const continueAction = getEnvironmentVariable("SEND_INACTIVE_ACCOUNT_DELETION_EMAILS") === "1" ? Actions.continue : Actions.abort;
  return { continue: continueAction, guardName: "SendInactiveAccountEmailsFeatureFlag" };
};
