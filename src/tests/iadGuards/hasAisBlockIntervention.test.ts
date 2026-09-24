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

  test("returns guardActivated: false when user is not blocked", async () => {
    mockIsUserIdBlocked.mockResolvedValue(false);

    const result = await hasAisBlockIntervention({
      commonSubjectId: "user-123",
    } as any);

    expect(result).toEqual({ guardActivated: false, guardName: "AIS" });
    expect(mockIsUserIdBlocked).toHaveBeenCalledWith("user-123");
  });

  test("returns guardActivated: true when user is blocked", async () => {
    mockIsUserIdBlocked.mockResolvedValue(true);

    const result = await hasAisBlockIntervention({
      commonSubjectId: "blocked-user",
    } as any);

    expect(result).toEqual({ guardActivated: true, guardName: "AIS" });
    expect(mockIsUserIdBlocked).toHaveBeenCalledWith("blocked-user");
  });

  test("propagates errors from isUserIdBlocked", async () => {
    mockIsUserIdBlocked.mockRejectedValue(new Error("AIS unavailable"));

    await expect(
      hasAisBlockIntervention({ commonSubjectId: "user-123" } as any)
    ).rejects.toThrow("AIS unavailable");
  });
});
