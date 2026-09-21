import { Guard } from "../../process-config.js";
import checkIfDateIs27October from "../../check-if-date-is-27-october.js";

export const dateForDeletionIs27October: Guard = async (
  _,
  __,
  dateForDeletion
) => {
  const is27October = checkIfDateIs27October(dateForDeletion ?? "");
  return {
    guardActivated: is27October,
    guardName: "DateForDeletionIs27October",
  };
};
