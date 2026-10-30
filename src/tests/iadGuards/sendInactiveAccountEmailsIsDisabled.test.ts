import { describe, afterEach, test, expect } from "vitest";
import { sendInactiveAccountEmailsIsDisabled } from "../../common/iadGuards/sendInactiveAccountEmailsIsDisabled.js";
import type { InactiveAccountTrackerRecord } from "../../common/model.js";

// The guard ignores its tracker-record argument, but the Guard type requires
// one, so pass a minimal cast record to satisfy the signature.
const trackerRecord = {} as InactiveAccountTrackerRecord;

describe("sendInactiveAccountEmailsIsDisabled", () => {
  afterEach(() => {
    delete process.env["SEND_INACTIVE_ACCOUNT_DELETION_EMAILS"];
  });

  test("returns guardActivated: false when the feature flag is enabled", async () => {
    process.env["SEND_INACTIVE_ACCOUNT_DELETION_EMAILS"] = "1";

    const result = await sendInactiveAccountEmailsIsDisabled(trackerRecord);

    expect(result).toEqual({
      guardActivated: false,
      guardName: "SendInactiveAccountEmailsFeatureFlag",
    });
  });

  test("returns guardActivated: true when the feature flag is disabled", async () => {
    process.env["SEND_INACTIVE_ACCOUNT_DELETION_EMAILS"] = "0";

    const result = await sendInactiveAccountEmailsIsDisabled(trackerRecord);

    expect(result).toEqual({
      guardActivated: true,
      guardName: "SendInactiveAccountEmailsFeatureFlag",
    });
  });
});
