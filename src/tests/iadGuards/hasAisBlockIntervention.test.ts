import { vi, describe, test, expect, beforeEach } from "vitest";

const mockGetAisStatus = vi.hoisted(() => vi.fn());

vi.mock("../../common/account-interventions-service-client.js", () => ({
  getAisStatus: mockGetAisStatus,
}));

import { hasAisBlockIntervention } from "../../common/iadGuards/hasAisBlockIntervention.js";

const aisState = (blocked: boolean) => ({
  state: { blocked, suspended: false, reproveIdentity: false, resetPassword: false },
});

describe("hasAisBlockIntervention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns continue: true when user is not blocked", async () => {
    mockGetAisStatus.mockResolvedValue(aisState(false));

    const result = await hasAisBlockIntervention("user-123");

    expect(result).toEqual({ continue: true, guardName: "AIS" });
    expect(mockGetAisStatus).toHaveBeenCalledWith("user-123");
  });

  test("returns continue: false when user is blocked", async () => {
    mockGetAisStatus.mockResolvedValue(aisState(true));

    const result = await hasAisBlockIntervention("blocked-user");

    expect(result).toEqual({ continue: false, guardName: "AIS" });
    expect(mockGetAisStatus).toHaveBeenCalledWith("blocked-user");
  });

  test("propagates errors from getAisStatus", async () => {
    mockGetAisStatus.mockRejectedValue(new Error("AIS unavailable"));

    await expect(hasAisBlockIntervention("user-123")).rejects.toThrow("AIS unavailable");
  });
});
