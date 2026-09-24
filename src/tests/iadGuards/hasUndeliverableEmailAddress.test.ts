import { describe, test, expect } from "vitest";
import { hasUndeliverableEmailAddress } from "../../common/iadGuards/hasUndeliverableEmailAddress.js";
import type { InactiveAccountTrackerRecord } from "../../common/model.js";

describe("hasUndeliverableEmailAddress", () => {
  test("returns guardActivated: false when hasUndeliverableEmailAddress is false", async () => {
    const result = await hasUndeliverableEmailAddress({
      hasUndeliverableEmailAddress: false,
    } as InactiveAccountTrackerRecord);
    expect(result).toEqual({
      guardActivated: false,
      guardName: "undeliverableEmailAddress",
    });
  });

  test("returns guardActivated: true when hasUndeliverableEmailAddress is true", async () => {
    const result = await hasUndeliverableEmailAddress({
      hasUndeliverableEmailAddress: true,
    } as InactiveAccountTrackerRecord);
    expect(result).toEqual({
      guardActivated: true,
      guardName: "undeliverableEmailAddress",
    });
  });

  test("returns guardActivated: false when hasUndeliverableEmailAddress is undefined", async () => {
    const result = await hasUndeliverableEmailAddress({
      hasUndeliverableEmailAddress: undefined,
    } as InactiveAccountTrackerRecord);
    expect(result).toEqual({
      guardActivated: false,
      guardName: "undeliverableEmailAddress",
    });
  });
});
