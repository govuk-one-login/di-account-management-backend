import { vi, describe, test, expect, beforeEach } from "vitest";
import { Context } from "aws-lambda";

vi.mock(
  "../../analyse-activity-log/scan-segment.js",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("../../analyse-activity-log/scan-segment.js")
      >();
    return {
      ...actual,
      scanSegment: vi.fn(),
    };
  }
);

import { handler } from "../../analyse-activity-log/handler.js";
import { scanSegment } from "../../analyse-activity-log/scan-segment.js";

const mockContext = {} as Context;
const mockScanSegment = vi.mocked(scanSegment);

describe("analyse-activity-log handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TABLE_NAME = "activity_log";
  });

  describe("input validation", () => {
    test("throws when totalSegments is missing", async () => {
      await expect(
        handler({} as { totalSegments: number }, mockContext)
      ).rejects.toThrow("totalSegments must be a positive integer");
    });

    test("throws when totalSegments is 0", async () => {
      await expect(handler({ totalSegments: 0 }, mockContext)).rejects.toThrow(
        "totalSegments must be a positive integer"
      );
    });

    test("throws when totalSegments is negative", async () => {
      await expect(handler({ totalSegments: -1 }, mockContext)).rejects.toThrow(
        "totalSegments must be a positive integer"
      );
    });

    test("throws when totalSegments is not an integer", async () => {
      await expect(
        handler({ totalSegments: 1.5 }, mockContext)
      ).rejects.toThrow("totalSegments must be a positive integer");
    });
  });

  describe("scan orchestration", () => {
    test("calls scanSegment once per segment", async () => {
      mockScanSegment.mockResolvedValue({
        perUserCounters: [[1, 0, 0, 0, 0, 0, 0]],
      });

      await handler({ totalSegments: 3 }, mockContext);

      expect(mockScanSegment).toHaveBeenCalledTimes(3);
      expect(mockScanSegment).toHaveBeenCalledWith(
        expect.anything(),
        "activity_log",
        0,
        3,
        expect.any(Array)
      );
      expect(mockScanSegment).toHaveBeenCalledWith(
        expect.anything(),
        "activity_log",
        1,
        3,
        expect.any(Array)
      );
      expect(mockScanSegment).toHaveBeenCalledWith(
        expect.anything(),
        "activity_log",
        2,
        3,
        expect.any(Array)
      );
    });

    test("throws when TABLE_NAME is not set", async () => {
      delete process.env.TABLE_NAME;

      await expect(handler({ totalSegments: 1 }, mockContext)).rejects.toThrow(
        'Environment variable "TABLE_NAME" is not set'
      );
    });

    test("throws when scan returns no items", async () => {
      mockScanSegment.mockResolvedValue({ perUserCounters: [] });

      await expect(handler({ totalSegments: 1 }, mockContext)).rejects.toThrow(
        "Scan returned no items"
      );
    });

    test("returns summed totals from all segments", async () => {
      mockScanSegment
        .mockResolvedValueOnce({
          perUserCounters: [
            [3, 1, 0, 0, 0, 0, 0],
            [5, 2, 1, 0, 0, 0, 0],
          ],
        })
        .mockResolvedValueOnce({
          perUserCounters: [[2, 0, 0, 0, 0, 0, 0]],
        });

      const result = await handler({ totalSegments: 2 }, mockContext);

      expect(result.total_users).toBe(3);
      expect(result.total_items).toBe(10);
      expect(result.scan_duration_seconds).toBeGreaterThanOrEqual(0);
      expect(result.items_per_user_distribution.mean).toBeCloseTo(10 / 3);
      expect(result.items_per_user_distribution.max).toBe(5);
      expect(result.concentration).toHaveProperty(
        "top_1_pct_users_own_pct_of_items"
      );
    });
  });
});
