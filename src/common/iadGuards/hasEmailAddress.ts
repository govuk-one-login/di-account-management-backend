import { Guard, Actions } from "../process-config.js";

export const hasEmailAddress: Guard = async (_, emailAddress) => {
  const continueAction =
    typeof emailAddress === "string" && emailAddress.length > 0
      ? Actions.continue
      : Actions.abort;
  return {
    continue: continueAction,
    guardName: "SendInactiveAccountEmailsFeatureFlag",
  };
};
