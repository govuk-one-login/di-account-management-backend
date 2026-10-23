import { Guard } from "../process-config.js";

export const doesNotHaveEmailAddress: Guard = ({ emailAddress }) => {
  const guardActivated =
    typeof emailAddress !== "string" || !emailAddress.length;
  return Promise.resolve({
    guardActivated,
    guardName: "DoesNotHaveEmailAddress",
  });
};
