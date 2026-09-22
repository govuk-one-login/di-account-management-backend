import { describe, afterEach, test, expect } from "vitest";
import { sendInactiveAccountEmailsIsDisabled } from "../../common/iadGuards/sendInactiveAccountEmailsIsDisabled.js";

describe("sendInactiveAccountEmailsIsDisabled", () => {
  afterEach(() => {
    delete process.env["SEND_INACTIVE_ACCOUNT_DELETION_EMAILS"];
  });

  test("returns guardActivated: false when the feature flag is enabled", async () => {
    process.env["SEND_INACTIVE_ACCOUNT_DELETION_EMAILS"] = "1";

    const result = await sendInactiveAccountEmailsIsDisabled();

    expect(result).toEqual({
      guardActivated: false,
      guardName: "SendInactiveAccountEmailsFeatureFlag",
    });
  });

  test("returns guardActivated: true when the feature flag is disabled", async () => {
    process.env["SEND_INACTIVE_ACCOUNT_DELETION_EMAILS"] = "0";

    const result = await sendInactiveAccountEmailsIsDisabled();

    expect(result).toEqual({
      guardActivated: true,
      guardName: "SendInactiveAccountEmailsFeatureFlag",
    });
  });
});
