import { vi, describe, test, expect, beforeEach } from "vitest";
import { Context } from "aws-lambda";

const mockMetrics = vi.hoisted(() => ({
  publishStoredMetrics: vi.fn(),
}));
const mockInitMetrics = vi.hoisted(() => vi.fn(() => mockMetrics));

vi.mock("../common/metrics.js", () => ({
  initMetrics: mockInitMetrics,
}));

import { handler } from "../send-inactive-warning-email.js";

describe("send-inactive-warning-email handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("logs hello world and publishes metrics", async () => {
    await handler({}, {} as Context);
    expect(mockMetrics.publishStoredMetrics).toHaveBeenCalledTimes(1);
  });
});
