import { describe, test, expect } from "vitest";
import { doesNotHaveEmailAddress } from "../../common/iadGuards/doesNotHaveEmailAddress.js";

describe("doesNotHaveEmailAddress", () => {
  test("returns guardActivated: false when emailAddress is a non-empty string", async () => {
    const result = await doesNotHaveEmailAddress(undefined, "user@example.com");
    expect(result).toEqual({ guardActivated: false, guardName: "DoesNotHaveEmailAddress" });
  });

  test("returns guardActivated: true when emailAddress is an empty string", async () => {
    const result = await doesNotHaveEmailAddress(undefined, "");
    expect(result).toEqual({ guardActivated: true, guardName: "DoesNotHaveEmailAddress" });
  });

  test("returns guardActivated: true when emailAddress is undefined", async () => {
    const result = await doesNotHaveEmailAddress(undefined, undefined);
    expect(result).toEqual({ guardActivated: true, guardName: "DoesNotHaveEmailAddress" });
  });
});
