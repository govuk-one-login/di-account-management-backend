import { describe, test, expect } from "vitest";
import { Actions } from "../../common/process-config.js";
import { hasEmailAddress } from "../../common/iadGuards/hasEmailAddress.js";

describe("hasEmailAddress", () => {
  test("returns continue when emailAddress is a non-empty string", async () => {
    const result = await hasEmailAddress(undefined, "user@example.com");
    expect(result).toEqual({
      continue: Actions.continue,
      guardName: "SendInactiveAccountEmailsFeatureFlag",
    });
  });

  test("returns abort when emailAddress is an empty string", async () => {
    const result = await hasEmailAddress(undefined, "");
    expect(result).toEqual({
      continue: Actions.abort,
      guardName: "SendInactiveAccountEmailsFeatureFlag",
    });
  });

  test("returns abort when emailAddress is undefined", async () => {
    const result = await hasEmailAddress(undefined, undefined);
    expect(result).toEqual({
      continue: Actions.abort,
      guardName: "SendInactiveAccountEmailsFeatureFlag",
    });
  });
});
