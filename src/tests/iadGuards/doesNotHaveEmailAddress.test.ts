import { describe, test, expect } from "vitest";
import { doesNotHaveEmailAddress } from "../../common/iadGuards/doesNotHaveEmailAddress.js";
import type { InactiveAccountTrackerRecord } from "../../common/model.js";

describe("doesNotHaveEmailAddress", () => {
  test("returns guardActivated: false when emailAddress is a non-empty string", async () => {
    const result = await doesNotHaveEmailAddress({
      emailAddress: "user@example.com",
    } as InactiveAccountTrackerRecord);
    expect(result).toEqual({
      guardActivated: false,
      guardName: "DoesNotHaveEmailAddress",
    });
  });

  test("returns guardActivated: true when emailAddress is an empty string", async () => {
    const result = await doesNotHaveEmailAddress({
      emailAddress: "",
    } as InactiveAccountTrackerRecord);
    expect(result).toEqual({
      guardActivated: true,
      guardName: "DoesNotHaveEmailAddress",
    });
  });

  test("returns guardActivated: true when emailAddress is undefined", async () => {
    const result = await doesNotHaveEmailAddress({
      emailAddress: undefined,
    } as InactiveAccountTrackerRecord);
    expect(result).toEqual({
      guardActivated: true,
      guardName: "DoesNotHaveEmailAddress",
    });
  });
});
