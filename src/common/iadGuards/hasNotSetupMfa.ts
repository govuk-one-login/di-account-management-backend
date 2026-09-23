import { Guard } from "../process-config.js";

export const hasNotSetupMfa: Guard = async (_, __, ___, ____, hasSetupMfa) => {
  const guardActivated = hasSetupMfa === false;

  return { guardActivated, guardName: "hasNotSetupMfa" };
};
