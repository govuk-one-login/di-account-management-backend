import { describe, test, expect } from "vitest";
import { mergeTrackerRecords } from "../common/merge-tracker-records.js";

describe("mergeTrackerRecords (shared module)", () => {
  type Record = Parameters<typeof mergeTrackerRecords>[0][number];

  const baseRecord = (overrides: Partial<Record> = {}): Record => ({
    commonSubjectId: "user-1",
    publicSubjectId: "public-1",
    dateForDeletion: "2030-01-01",
    status: "pending",
    statusLastUpdated: "2026-01-01T00:00:00.000Z",
    userLastActive: "2021-01-01T00:00:00.000Z",
    userLastActiveSource: "AUTH_EVENT",
    userLastActiveUpdated: "2026-01-01T00:00:00.000Z",
    hasSetupMfa: false,
    ...overrides,
  });

  test("throws when given an empty set of records", () => {
    expect(() => mergeTrackerRecords([])).toThrow(
      "cannot merge an empty set of tracker records"
    );
  });

  test("takes userLastActive group (incl. dateForDeletion/publicSubjectId) from the record with the newest userLastActiveUpdated", () => {
    const older = baseRecord({
      dateForDeletion: "2030-01-01",
      publicSubjectId: "old-public",
      userLastActive: "2021-01-01T00:00:00.000Z",
      userLastActiveSource: "OLD_SOURCE",
      userLastActiveSourceId: "old-id",
      userLastActiveUpdated: "2026-01-01T00:00:00.000Z",
    });
    const newer = baseRecord({
      dateForDeletion: "2031-06-01",
      publicSubjectId: "new-public",
      userLastActive: "2026-06-01T00:00:00.000Z",
      userLastActiveSource: "NEW_SOURCE",
      userLastActiveSourceId: "new-id",
      userLastActiveUpdated: "2026-06-01T00:00:00.000Z",
    });

    const merged = mergeTrackerRecords([older, newer]);

    expect(merged.userLastActive).toBe("2026-06-01T00:00:00.000Z");
    expect(merged.userLastActiveSource).toBe("NEW_SOURCE");
    expect(merged.userLastActiveSourceId).toBe("new-id");
    expect(merged.userLastActiveUpdated).toBe("2026-06-01T00:00:00.000Z");
    expect(merged.dateForDeletion).toBe("2031-06-01");
    expect(merged.publicSubjectId).toBe("new-public");
  });

  test("takes email group from the record with the newest emailAddressLastUpdated, independent of activity", () => {
    const newestActivity = baseRecord({
      userLastActiveUpdated: "2026-12-01T00:00:00.000Z",
      emailAddress: "stale@example.com",
      emailAddressSource: "STALE_EMAIL_SOURCE",
      emailAddressSourceId: "stale-email-id",
      emailAddressLastUpdated: "2020-01-01T00:00:00.000Z",
    });
    const newestEmail = baseRecord({
      userLastActiveUpdated: "2021-01-01T00:00:00.000Z",
      emailAddress: "fresh@example.com",
      emailAddressSource: "FRESH_EMAIL_SOURCE",
      emailAddressSourceId: "fresh-email-id",
      emailAddressLastUpdated: "2026-06-01T00:00:00.000Z",
    });

    const merged = mergeTrackerRecords([newestActivity, newestEmail]);

    expect(merged.emailAddress).toBe("fresh@example.com");
    expect(merged.emailAddressSource).toBe("FRESH_EMAIL_SOURCE");
    expect(merged.emailAddressSourceId).toBe("fresh-email-id");
    expect(merged.emailAddressLastUpdated).toBe("2026-06-01T00:00:00.000Z");
  });

  test("takes status from the record with the newest statusLastUpdated", () => {
    const older = baseRecord({ status: "pending", statusLastUpdated: "2026-01-01T00:00:00.000Z" });
    const newer = baseRecord({ status: "30DayWarningSent", statusLastUpdated: "2026-09-01T00:00:00.000Z" });

    const merged = mergeTrackerRecords([older, newer]);

    expect(merged.status).toBe("30DayWarningSent");
    expect(merged.statusLastUpdated).toBe("2026-09-01T00:00:00.000Z");
  });

  test("treats hasSetupMfa and hasUndeliverableEmailAddress as sticky-true across duplicates", () => {
    const a = baseRecord({ hasSetupMfa: false, hasUndeliverableEmailAddress: false, userLastActiveUpdated: "2026-06-01T00:00:00.000Z" });
    const b = baseRecord({ hasSetupMfa: true, hasUndeliverableEmailAddress: true, userLastActiveUpdated: "2020-01-01T00:00:00.000Z" });

    const merged = mergeTrackerRecords([a, b]);

    expect(merged.hasSetupMfa).toBe(true);
    expect(merged.hasUndeliverableEmailAddress).toBe(true);
  });

  test("omits the email group entirely when no duplicate has an email address", () => {
    const a = baseRecord();
    const b = baseRecord({ userLastActiveUpdated: "2026-06-01T00:00:00.000Z" });

    const merged = mergeTrackerRecords([a, b]);

    expect(merged.emailAddress).toBeUndefined();
    expect(merged.emailAddressLastUpdated).toBeUndefined();
    expect(merged.emailAddressSource).toBeUndefined();
    expect(merged.emailAddressSourceId).toBeUndefined();
  });

  test("returns the single record unchanged in shape when only one is provided", () => {
    const only = baseRecord({ emailAddress: "solo@example.com", emailAddressLastUpdated: "2026-01-01T00:00:00.000Z" });

    const merged = mergeTrackerRecords([only]);

    expect(merged.commonSubjectId).toBe("user-1");
    expect(merged.userLastActive).toBe("2021-01-01T00:00:00.000Z");
    expect(merged.emailAddress).toBe("solo@example.com");
    expect(merged.status).toBe("pending");
  });
});
