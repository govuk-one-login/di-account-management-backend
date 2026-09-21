import { describe, test, expect } from "vitest";
import { dateForDeletionIs27October } from "../../common/iadGuards/dateForDeletionIs27October.js";

describe("dateForDeletionIs27October", () => {
  test("returns guardActivated: false when dateForDeletion is not 2026-10-27", async () => {
    const result = await dateForDeletionIs27October("user-123", "oldverifyuser@asdf", "2026-10-28");

    expect(result).toEqual({ guardActivated: false, guardName: "DateForDeletionIs27October" });
  });

  test("returns guardActivated: true when dateForDeletion is 2026-10-27", async () => {
    const result = await dateForDeletionIs27October("user-123", "oldverifyuser@asdf", "2026-10-27");

    expect(result).toEqual({ guardActivated: true, guardName: "DateForDeletionIs27October" });
  });
});
