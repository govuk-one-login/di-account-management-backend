import { vi, describe, afterEach, test, expect, beforeEach } from "vitest";
import { Actions } from "../../common/process-config.js";
import { sendInactiveAccountEmailsIsEnabled } from "../../common/iadGuards/sendInactiveAccountEmailsIsEnabled.js";
describe("sendInactiveAccountEmailsIsEnabled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env["SEND_INACTIVE_ACCOUNT_DELETION_EMAILS"];
  });

  test("returns continue when the feature flag is enabled", async () => {
    process.env["SEND_INACTIVE_ACCOUNT_DELETION_EMAILS"] = "1";

    const result = await sendInactiveAccountEmailsIsEnabled();

    expect(result).toEqual({
      continue: Actions.continue,
      guardName: "SendInactiveAccountEmailsFeatureFlag",
    });
  });

  test("returns continueWithoutActions when the feature flag is disabled", async () => {
    process.env["SEND_INACTIVE_ACCOUNT_DELETION_EMAILS"] = "0";

    const result = await sendInactiveAccountEmailsIsEnabled();

    expect(result).toEqual({
      continue: Actions.continueWithoutActions,
      guardName: "SendInactiveAccountEmailsFeatureFlag",
    });
  });
});
