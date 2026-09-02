import { vi, describe, test, expect, beforeEach } from "vitest";

const mockIsUserIdBlocked = vi.hoisted(() => vi.fn());

vi.mock("../../common/account-interventions-service-client.js", () => ({
  isUserIdBlocked: mockIsUserIdBlocked,
}));

import { hasAisBlockIntervention } from "../../common/iadGuards/hasAisBlockIntervention.js";

describe("hasAisBlockIntervention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns continue: 'Continue' when user is not blocked", async () => {
    mockIsUserIdBlocked.mockResolvedValue(false);

    const result = await hasAisBlockIntervention("user-123");

    expect(result).toEqual({ continue: 'Continue', guardName: "AIS" });
    expect(mockIsUserIdBlocked).toHaveBeenCalledWith("user-123");
  });

  test("returns continue: 'ContinueWithoutPerformingActions' when user is blocked", async () => {
    mockIsUserIdBlocked.mockResolvedValue(true);

    const result = await hasAisBlockIntervention("blocked-user");

    expect(result).toEqual({ continue: 'ContinueWithoutPerformingActions', guardName: "AIS" });
    expect(mockIsUserIdBlocked).toHaveBeenCalledWith("blocked-user");
  });

  test("propagates errors from isUserIdBlocked", async () => {
    mockIsUserIdBlocked.mockRejectedValue(new Error("AIS unavailable"));

    await expect(hasAisBlockIntervention("user-123")).rejects.toThrow("AIS unavailable");
  });
});
