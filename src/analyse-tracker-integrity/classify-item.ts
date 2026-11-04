import { AttributeValue } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import * as v from "valibot";
import { processableInactiveAccountTrackerRecordSchema } from "../common/model.js";

const EXPECTED_FIELDS = new Set(
  Object.keys(processableInactiveAccountTrackerRecordSchema.entries)
);
const REDACTED_FIELDS = new Set(["commonSubjectId", "emailAddress"]);

interface ClassifyItemResult {
  issues: { field: string | undefined; message: string }[];
  logEntry: Record<string, unknown>;
}

const buildLogEntry = (
  item: Record<string, unknown>
): Record<string, unknown> => {
  const logEntry: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(item)) {
    if (!EXPECTED_FIELDS.has(key)) continue;

    if (REDACTED_FIELDS.has(key) && typeof value === "string") {
      logEntry[`${key}Length`] = value.length;
    } else {
      logEntry[key] = value;
    }
  }
  return logEntry;
};

export const classifyItem = (
  rawItem: Record<string, AttributeValue>
): ClassifyItemResult | null => {
  const item = unmarshall(rawItem) as Record<string, unknown>;

  const result = v.safeParse(
    processableInactiveAccountTrackerRecordSchema,
    item
  );
  if (result.success) return null;

  const issues = result.issues.map((issue) => ({
    field: issue.path?.[0]?.key as string | undefined,
    message: issue.message,
  }));

  return {
    issues,
    logEntry: buildLogEntry(item),
  };
};
