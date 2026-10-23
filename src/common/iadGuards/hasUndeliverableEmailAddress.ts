import { Guard } from "../process-config.js";

export const hasUndeliverableEmailAddress: Guard = ({
  hasUndeliverableEmailAddress,
}) => {
  const guardActivated = hasUndeliverableEmailAddress === true;

  return Promise.resolve({
    guardActivated,
    guardName: "undeliverableEmailAddress",
  });
};
