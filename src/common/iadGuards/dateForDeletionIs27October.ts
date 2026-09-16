import { Guard, Actions } from "../process-config.js";
import checkIfDateIs27October from "../check-if-date-is-27-october.js";

export const dateForDeletionIs27October: Guard = async (_, __, dateForDeletion) => {
  const continueAction =
    checkIfDateIs27October(dateForDeletion ?? "")
      ? Actions.continueWithoutActions
      : Actions.continue;
  return {
    continue: continueAction,
    guardName: "DateForDeletionIs27October",
  };
};
