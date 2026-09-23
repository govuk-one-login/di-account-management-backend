import { Guard } from "../process-config.js";

export const hasUndeliverableEmailAddress: Guard = async (
  _,
  __,
  ___,
  hasUndeliverableEmailAddress
) => {
  const guardActivated = hasUndeliverableEmailAddress === true;

  return { guardActivated, guardName: "undeliverableEmailAddress" };
};
