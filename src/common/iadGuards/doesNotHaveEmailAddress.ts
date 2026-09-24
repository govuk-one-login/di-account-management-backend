import { Guard } from "../process-config.js";

export const doesNotHaveEmailAddress: Guard = async ({ emailAddress }) => {
  const guardActivated =
    typeof emailAddress !== "string" || !emailAddress.length;
  return {
    guardActivated,
    guardName: "DoesNotHaveEmailAddress",
  };
};
