import { Guard, Actions } from "../process-config.js";

export const sendInactiveAccountEmailsIsEnabled: Guard = async () => {
  const continueAction = process.env["SEND_INACTIVE_ACCOUNT_DELETION_EMAILS"] === "1" ? Actions.continue : Actions.abort;
  return { continue: continueAction, guardName: "SendInactiveAccountEmailsFeatureFlag" };
};
