import { describe, test, expect } from "vitest";
import { AttributeValue } from "@aws-sdk/client-dynamodb";
import { classifyItem } from "../../analyse-tracker-integrity/classify-item.js";

const COMMON_SUBJECT_ID = "common-subject-id-123";

const baseItem = (): Record<string, AttributeValue> => ({
  dateForDeletion: { S: "2026-01-01" },
  commonSubjectId: { S: COMMON_SUBJECT_ID },
  publicSubjectId: { S: "public-subject-id-123" },
  status: { S: "pending" },
  statusLastUpdated: { S: "2026-01-01T00:00:00.000Z" },
  userLastActive: { S: "2025-01-01T00:00:00.000Z" },
  userLastActiveSource: { S: "AUTH_AUTH_CODE_ISSUED" },
  userLastActiveSourceId: { S: "event-id-123" },
  userLastActiveUpdated: { S: "2026-01-01T00:00:00.000Z" },
  emailAddress: { S: "user@example.com" },
  emailAddressLastUpdated: { S: "2026-01-01T00:00:00.000Z" },
  emailAddressSource: { S: "AUTH_UPDATE_EMAIL" },
  emailAddressSourceId: { S: "event-id-456" },
  hasSetupMfa: { BOOL: true },
  hasUndeliverableEmailAddress: { BOOL: false },
});

const withoutField = (
  item: Record<string, AttributeValue>,
  field: string
): Record<string, AttributeValue> => {
  const copy = { ...item };
  delete copy[field];
  return copy;
};

describe("classifyItem", () => {
  test("returns null for a clean item", () => {
    expect(classifyItem(baseItem())).toBeNull();
  });

  test("reports an issue when a required field is absent", () => {
    const item = withoutField(baseItem(), "emailAddress");
    const result = classifyItem(item);

    expect(result).not.toBeNull();
    expect(result!.issues.some((issue) => issue.field === "emailAddress")).toBe(
      true
    );
  });

  test("reports an issue when emailAddress is an empty string", () => {
    const item = { ...baseItem(), emailAddress: { S: "" } };
    const result = classifyItem(item);

    expect(result).not.toBeNull();
    expect(result!.issues.some((issue) => issue.field === "emailAddress")).toBe(
      true
    );
  });

  test("reports an issue when status is not a recognised value", () => {
    const item = { ...baseItem(), status: { S: "unknownStatus" } };
    const result = classifyItem(item);

    expect(result).not.toBeNull();
    expect(result!.issues.some((issue) => issue.field === "status")).toBe(true);
  });

  test("reports an issue when dateForDeletion is not YYYY-MM-DD", () => {
    const item = { ...baseItem(), dateForDeletion: { S: "01/01/2026" } };
    const result = classifyItem(item);

    expect(result).not.toBeNull();
    expect(
      result!.issues.some((issue) => issue.field === "dateForDeletion")
    ).toBe(true);
  });

  test("reports an issue when hasSetupMfa is not boolean", () => {
    const item = { ...baseItem(), hasSetupMfa: { S: "true" } };
    const result = classifyItem(item);

    expect(result).not.toBeNull();
    expect(result!.issues.some((issue) => issue.field === "hasSetupMfa")).toBe(
      true
    );
  });

  test("does not flag commonSubjectId for any particular shape, only presence and non-emptiness", () => {
    const item = { ...baseItem(), commonSubjectId: { S: "not-a-valid-id" } };
    expect(classifyItem(item)).toBeNull();
  });

  test("reports an issue when commonSubjectId is an empty string", () => {
    const item = { ...baseItem(), commonSubjectId: { S: "" } };
    const result = classifyItem(item);

    expect(result).not.toBeNull();
    expect(
      result!.issues.some((issue) => issue.field === "commonSubjectId")
    ).toBe(true);
  });

  test("does not flag an anomaly for a whitespace-only or no-@ emailAddress, since it is just a non-empty string", () => {
    expect(
      classifyItem({ ...baseItem(), emailAddress: { S: "   " } })
    ).toBeNull();
    expect(
      classifyItem({ ...baseItem(), emailAddress: { S: "not-an-email" } })
    ).toBeNull();
  });

  test("reports multiple issues simultaneously", () => {
    let item: Record<string, AttributeValue> = {
      ...baseItem(),
      dateForDeletion: { S: "bad-date" },
    };
    item = withoutField(item, "emailAddress");

    const result = classifyItem(item);

    expect(result).not.toBeNull();
    expect(result!.issues.length).toBeGreaterThanOrEqual(2);
  });

  test("log entry never contains commonSubjectId as a key, only its length", () => {
    const item = { ...baseItem(), dateForDeletion: { S: "bad-date" } };
    const result = classifyItem(item);

    expect(result).not.toBeNull();
    expect(Object.keys(result!.logEntry)).not.toContain("commonSubjectId");
    expect(result!.logEntry.commonSubjectIdLength).toBe(
      COMMON_SUBJECT_ID.length
    );
  });

  test("log entry never contains emailAddress as a key, only its length", () => {
    const item = { ...baseItem(), dateForDeletion: { S: "bad-date" } };
    const result = classifyItem(item);

    expect(result).not.toBeNull();
    expect(Object.keys(result!.logEntry)).not.toContain("emailAddress");
    expect(result!.logEntry.emailAddressLength).toBe("user@example.com".length);
  });

  test("log entry includes other fields in full", () => {
    const item = { ...baseItem(), status: { S: "unknownStatus" } };
    const result = classifyItem(item);

    expect(result).not.toBeNull();
    expect(result!.logEntry.publicSubjectId).toBe("public-subject-id-123");
    expect(result!.logEntry.dateForDeletion).toBe("2026-01-01");
  });

  test("does not flag an item for having an attribute outside the declared schema", () => {
    const item = {
      ...baseItem(),
      someUnexpectedField: { S: "value" },
    };
    expect(classifyItem(item)).toBeNull();
  });

  test("log entry never includes an undeclared attribute, since its value was never validated", () => {
    const item = {
      ...baseItem(),
      dateForDeletion: { S: "bad-date" },
      someUnexpectedField: { S: "value" },
    };
    const result = classifyItem(item);

    expect(result).not.toBeNull();
    expect(Object.keys(result!.logEntry)).not.toContain("someUnexpectedField");
  });
});
