import { describe, test, expect } from "vitest";
import { hasUndeliverableEmailAddress } from "../../common/iadGuards/hasUndeliverableEmailAddress.js";

describe("hasUndeliverableEmailAddress", () => {
  test("returns guardActivated: false when hasUndeliverableEmailAddress is false", async () => {
    const result = await hasUndeliverableEmailAddress(
      undefined,
      undefined,
      undefined,
      false
    );
    expect(result).toEqual({
      guardActivated: false,
      guardName: "undeliverableEmailAddress",
    });
  });

  test("returns guardActivated: true when hasUndeliverableEmailAddress is true", async () => {
    const result = await hasUndeliverableEmailAddress(
      undefined,
      undefined,
      undefined,
      true
    );
    expect(result).toEqual({
      guardActivated: true,
      guardName: "undeliverableEmailAddress",
    });
  });

  test("returns guardActivated: false when hasUndeliverableEmailAddress is undefined", async () => {
    const result = await hasUndeliverableEmailAddress(
      undefined,
      undefined,
      undefined,
      undefined
    );
    expect(result).toEqual({
      guardActivated: false,
      guardName: "undeliverableEmailAddress",
    });
  });
});
