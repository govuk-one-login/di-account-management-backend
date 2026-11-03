import * as v from "valibot";
import { processableInactiveAccountTrackerRecordSchema } from "../model.js";
import { Guard } from "../process-config.js";

export const hasDataIntegrityIssue: Guard = (trackerRecord) => {
  const result = v.safeParse(
    processableInactiveAccountTrackerRecordSchema,
    trackerRecord
  );

  return Promise.resolve({
    guardActivated: !result.success,
    guardName: "HasDataIntegrityIssue",
  });
};
