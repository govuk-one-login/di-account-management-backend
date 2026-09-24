import { describe, test, expect } from "vitest";
import { hasUndeliverableEmailAddress } from "../../common/iadGuards/hasUndeliverableEmailAddress.js";

describe("hasUndeliverableEmailAddress", () => {
  test("returns guardActivated: false when hasUndeliverableEmailAddress is false", async () => {
    const result = await hasUndeliverableEmailAddress({
      hasUndeliverableEmailAddress: false,
    } as any);
    expect(result).toEqual({
      guardActivated: false,
      guardName: "undeliverableEmailAddress",
    });
  });

  test("returns guardActivated: true when hasUndeliverableEmailAddress is true", async () => {
    const result = await hasUndeliverableEmailAddress({
      hasUndeliverableEmailAddress: true,
    } as any);
    expect(result).toEqual({
      guardActivated: true,
      guardName: "undeliverableEmailAddress",
    });
  });

  test("returns guardActivated: false when hasUndeliverableEmailAddress is undefined", async () => {
    const result = await hasUndeliverableEmailAddress({
      hasUndeliverableEmailAddress: undefined,
    } as any);
    expect(result).toEqual({
      guardActivated: false,
      guardName: "undeliverableEmailAddress",
    });
  });
});
