import { describe, test, expect } from "vitest";
import { getNewDateForInactiveAccountDeletion } from "../common/get-new-date-for-inactive-account-deletion.js";

describe("getNewDateForInactiveAccountDeletion", () => {
  test("returns a date 5 years after the given date", () => {
    expect(
      getNewDateForInactiveAccountDeletion(new Date("2026-06-15T12:00:00.000Z"))
    ).toBe("2031-06-15");
  });

  test("returns date-only format without time component", () => {
    expect(
      getNewDateForInactiveAccountDeletion(new Date("2024-03-01T23:59:59.999Z"))
    ).toBe("2029-03-01");
  });

  test("handles leap day by rolling to March 1st", () => {
    expect(
      getNewDateForInactiveAccountDeletion(new Date("2024-02-29T00:00:00.000Z"))
    ).toBe("2029-03-01");
  });

  test("handles epoch date", () => {
    expect(
      getNewDateForInactiveAccountDeletion(new Date("1970-01-01T00:00:00.000Z"))
    ).toBe("1975-01-01");
  });
});
