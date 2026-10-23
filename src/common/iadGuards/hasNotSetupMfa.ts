import { Guard } from "../process-config.js";

export const hasNotSetupMfa: Guard = ({ hasSetupMfa }) => {
  const guardActivated = hasSetupMfa === false;

  return Promise.resolve({ guardActivated, guardName: "hasNotSetupMfa" });
};
