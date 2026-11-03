import { describe, test, expect } from "vitest";
import { hasDataIntegrityIssue } from "../../common/iadGuards/hasDataIntegrityIssue.js";
import type { ConstructingInactiveAccountTrackerRecord } from "../../common/model.js";

const validRecord = (): ConstructingInactiveAccountTrackerRecord => ({
  dateForDeletion: "2026-01-01",
  commonSubjectId: "urn:fdc:gov.uk:2022:" + "a".repeat(43),
  publicSubjectId: "public-subject-id-123",
  status: "pending",
  statusLastUpdated: "2026-01-01T00:00:00.000Z",
  userLastActive: "2025-01-01T00:00:00.000Z",
  userLastActiveSource: "TICF_ACCOUNT_DELETED",
  userLastActiveSourceId: "event-id-123",
  userLastActiveUpdated: "2026-01-01T00:00:00.000Z",
  emailAddress: "user@example.com",
  emailAddressLastUpdated: "2026-01-01T00:00:00.000Z",
  emailAddressSource: "AUTHENTICATE_EMAIL_CHANGED",
  emailAddressSourceId: "event-id-456",
  hasSetupMfa: true,
});

describe("hasDataIntegrityIssue", () => {
  test("returns guardActivated: false for a fully processable record", async () => {
    const result = await hasDataIntegrityIssue(validRecord());
    expect(result).toEqual({
      guardActivated: false,
      guardName: "HasDataIntegrityIssue",
    });
  });

  test("returns guardActivated: true when emailAddress is an empty string", async () => {
    const result = await hasDataIntegrityIssue({
      ...validRecord(),
      emailAddress: "",
    });
    expect(result).toEqual({
      guardActivated: true,
      guardName: "HasDataIntegrityIssue",
    });
  });

  test("returns guardActivated: true when emailAddress is undefined", async () => {
    const record = validRecord();
    delete record.emailAddress;

    const result = await hasDataIntegrityIssue(record);
    expect(result).toEqual({
      guardActivated: true,
      guardName: "HasDataIntegrityIssue",
    });
  });

  test("returns guardActivated: true when status is not a recognised value", async () => {
    const result = await hasDataIntegrityIssue({
      ...validRecord(),
      status: "unknownStatus",
    } as unknown as ConstructingInactiveAccountTrackerRecord);
    expect(result).toEqual({
      guardActivated: true,
      guardName: "HasDataIntegrityIssue",
    });
  });

  test("returns guardActivated: true when dateForDeletion is not a valid ISO date", async () => {
    const result = await hasDataIntegrityIssue({
      ...validRecord(),
      dateForDeletion: "01/01/2026",
    });
    expect(result).toEqual({
      guardActivated: true,
      guardName: "HasDataIntegrityIssue",
    });
  });

  test("returns guardActivated: true when a required field is missing", async () => {
    const record = validRecord();
    delete (record as Partial<ConstructingInactiveAccountTrackerRecord>)
      .userLastActiveSourceId;

    const result = await hasDataIntegrityIssue(record);
    expect(result).toEqual({
      guardActivated: true,
      guardName: "HasDataIntegrityIssue",
    });
  });
});
