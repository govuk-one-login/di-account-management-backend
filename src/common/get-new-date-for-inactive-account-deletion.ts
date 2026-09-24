export const getNewDateForInactiveAccountDeletion = (
  latestDate: Date
): string => {
  const deletionDate = new Date(latestDate);
  deletionDate.setFullYear(deletionDate.getFullYear() + 5);
  return deletionDate.toISOString().split("T")[0];
};
