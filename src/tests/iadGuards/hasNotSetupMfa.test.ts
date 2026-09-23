import { describe, test, expect } from "vitest";
import { hasNotSetupMfa } from "../../common/iadGuards/hasNotSetupMfa.js";

describe("hasNotSetupMfa", () => {
  test("returns guardActivated: false when hasSetupMfa is true", async () => {
    const result = await hasNotSetupMfa(
      undefined,
      undefined,
      undefined,
      undefined,
      true
    );
    expect(result).toEqual({
      guardActivated: false,
      guardName: "hasNotSetupMfa",
    });
  });

  test("returns guardActivated: true when hasSetupMfa is false", async () => {
    const result = await hasNotSetupMfa(
      undefined,
      undefined,
      undefined,
      undefined,
      false
    );
    expect(result).toEqual({
      guardActivated: true,
      guardName: "hasNotSetupMfa",
    });
  });

  test("returns guardActivated: false when hasSetupMfa is undefined", async () => {
    const result = await hasNotSetupMfa(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    );
    expect(result).toEqual({
      guardActivated: false,
      guardName: "hasNotSetupMfa",
    });
  });
});
