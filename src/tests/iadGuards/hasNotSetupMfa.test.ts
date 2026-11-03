import { describe, test, expect } from "vitest";
import { hasNotSetupMfa } from "../../common/iadGuards/hasNotSetupMfa.js";
import type { ConstructingInactiveAccountTrackerRecord } from "../../common/model.js";

describe("hasNotSetupMfa", () => {
  test("returns guardActivated: false when hasSetupMfa is true", async () => {
    const result = await hasNotSetupMfa({
      hasSetupMfa: true,
    } as ConstructingInactiveAccountTrackerRecord);
    expect(result).toEqual({
      guardActivated: false,
      guardName: "hasNotSetupMfa",
    });
  });

  test("returns guardActivated: true when hasSetupMfa is false", async () => {
    const result = await hasNotSetupMfa({
      hasSetupMfa: false,
    } as ConstructingInactiveAccountTrackerRecord);
    expect(result).toEqual({
      guardActivated: true,
      guardName: "hasNotSetupMfa",
    });
  });

  test("returns guardActivated: false when hasSetupMfa is undefined", async () => {
    const result = await hasNotSetupMfa({
      hasSetupMfa: undefined,
    } as unknown as ConstructingInactiveAccountTrackerRecord);
    expect(result).toEqual({
      guardActivated: false,
      guardName: "hasNotSetupMfa",
    });
  });
});
