import { Guard } from "../process-config.js";

export const hasNotSetupMfa: Guard = async ({ hasSetupMfa }) => {
  const guardActivated = hasSetupMfa === false;

  return { guardActivated, guardName: "hasNotSetupMfa" };
};
