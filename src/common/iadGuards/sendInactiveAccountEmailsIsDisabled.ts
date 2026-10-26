import { Guard } from "../process-config.js";
import { getEnvironmentVariable } from "../utils.js";

export const sendInactiveAccountEmailsIsDisabled: Guard = () => {
  const guardActivated =
    getEnvironmentVariable("SEND_INACTIVE_ACCOUNT_DELETION_EMAILS") !== "1";
  return Promise.resolve({
    guardActivated,
    guardName: "SendInactiveAccountEmailsFeatureFlag",
  });
};
