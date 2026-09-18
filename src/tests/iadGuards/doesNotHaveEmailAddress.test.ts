import { describe, test, expect } from "vitest";
import { Actions } from "../../common/process-config.js";
import { doesNotHaveEmailAddress } from "../../common/iadGuards/doesNotHaveEmailAddress.js";

describe("doesNotHaveEmailAddress", () => {
  test("returns continue when emailAddress is a non-empty string", async () => {
    const result = await doesNotHaveEmailAddress(undefined, "user@example.com");
    expect(result).toEqual({
      continue: Actions.continue,
      guardName: "DoesNotHaveEmailAddress",
    });
  });

  test("returns abort when emailAddress is an empty string", async () => {
    const result = await doesNotHaveEmailAddress(undefined, "");
    expect(result).toEqual({
      continue: Actions.abort,
      guardName: "DoesNotHaveEmailAddress",
    });
  });

  test("returns abort when emailAddress is undefined", async () => {
    const result = await doesNotHaveEmailAddress(undefined, undefined);
    expect(result).toEqual({
      continue: Actions.abort,
      guardName: "DoesNotHaveEmailAddress",
    });
  });
});
