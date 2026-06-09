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
    test("calls scanSegment with deadline option", async () => {
      mockScanSegment.mockResolvedValue({
        perUserCounters: [[1, 0, 0, 0, 0, 0, 0]],
        exclusiveAgeBuckets: [1, 0, 0, 0, 0, 0, 0],
        exhausted: true,
      });

      await handler({ totalSegments: 3 }, mockContext);

      expect(mockScanSegment).toHaveBeenCalledTimes(3);
      expect(mockScanSegment).toHaveBeenCalledWith(
        expect.anything(),
        "activity_log",
        0,
        3,
        expect.any(Array),
        expect.objectContaining({ deadlineMs: expect.any(Number) })
      );
    });

    test("throws when TABLE_NAME is not set", async () => {
      delete process.env.TABLE_NAME;

      await expect(handler({ totalSegments: 1 }, mockContext)).rejects.toThrow(
        'Environment variable "TABLE_NAME" is not set'
      );
    });

    test("throws when scan returns no items", async () => {
      mockScanSegment.mockResolvedValue({
        perUserCounters: [],
        exclusiveAgeBuckets: [0, 0, 0, 0, 0, 0, 0],
        exhausted: true,
      });

      await expect(handler({ totalSegments: 1 }, mockContext)).rejects.toThrow(
        "Scan returned no items"
      );
    });

    test("returns scan_complete true when all segments exhaust", async () => {
      mockScanSegment.mockResolvedValue({
        perUserCounters: [[3, 1, 0, 0, 0, 0, 0]],
        exclusiveAgeBuckets: [2, 1, 0, 0, 0, 0, 0],
        exhausted: true,
      });

      const result = await handler({ totalSegments: 2 }, mockContext);

      expect(result.scan_complete).toBe(true);
    });

    test("returns scan_complete false when segments incomplete", async () => {
      mockScanSegment
        .mockResolvedValueOnce({
          perUserCounters: [[3, 1, 0, 0, 0, 0, 0]],
          exclusiveAgeBuckets: [2, 1, 0, 0, 0, 0, 0],
          exhausted: true,
        })
        .mockResolvedValueOnce({
          perUserCounters: [[2, 0, 0, 0, 0, 0, 0]],
          exclusiveAgeBuckets: [2, 0, 0, 0, 0, 0, 0],
          exhausted: false,
          cursor: {
            lastEvaluatedKey: { user_id: { S: "user-x" } },
            lastUserId: "user-x",
            lastUserCounters: [2, 0, 0, 0, 0, 0, 0],
          },
        });

      const result = await handler({ totalSegments: 2 }, mockContext);

      expect(result.scan_complete).toBe(false);
    });

    test("returns report from whatever was scanned", async () => {
      mockScanSegment
        .mockResolvedValueOnce({
          perUserCounters: [
            [3, 1, 0, 0, 0, 0, 0],
            [5, 2, 1, 0, 0, 0, 0],
          ],
          exclusiveAgeBuckets: [5, 2, 1, 0, 0, 0, 0],
          exhausted: true,
        })
        .mockResolvedValueOnce({
          perUserCounters: [[2, 0, 0, 0, 0, 0, 0]],
          exclusiveAgeBuckets: [2, 0, 0, 0, 0, 0, 0],
          exhausted: true,
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
      expect(result.items_per_user_buckets["2-5"].user_count).toBe(3);
      expect(result.items_by_age_bucket["0-1_months"].count).toBe(7);
      expect(result.items_by_age_bucket["1-3_months"].count).toBe(2);
    });

    test("produces a complete report from realistic multi-segment data", async () => {
      mockScanSegment
        .mockResolvedValueOnce({
          perUserCounters: [
            [1, 0, 0, 0, 0, 0, 0],
            [4, 2, 1, 0, 0, 0, 0],
            [12, 10, 8, 5, 2, 0, 0],
            [50, 45, 40, 30, 20, 10, 5],
          ],
          exclusiveAgeBuckets: [10, 12, 8, 10, 12, 10, 5],
          exhausted: true,
        })
        .mockResolvedValueOnce({
          perUserCounters: [
            [1, 0, 0, 0, 0, 0, 0],
            [3, 1, 0, 0, 0, 0, 0],
            [8, 6, 4, 2, 0, 0, 0],
            [25, 20, 15, 10, 5, 2, 0],
          ],
          exclusiveAgeBuckets: [8, 10, 6, 5, 5, 2, 1],
          exhausted: true,
        });

      const result = await handler({ totalSegments: 2 }, mockContext);

      expect(result.scan_date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(result.total_users).toBe(8);
      expect(result.total_items).toBe(104);
      expect(result.items_per_user_distribution.mean).toBe(13);
      expect(result.items_per_user_distribution.median).toBe(4);
      expect(result.items_per_user_distribution.max).toBe(50);
      expect(result.items_per_user_distribution.p90).toBe(50);
      expect(
        result.concentration.top_10_pct_users_own_pct_of_items
      ).toBeGreaterThan(0);
      expect(result.items_per_user_buckets["1"].user_count).toBe(2);
      expect(result.items_per_user_buckets["2-5"].user_count).toBe(2);
      expect(result.items_per_user_buckets["6-10"].user_count).toBe(1);
      expect(result.items_per_user_buckets["11-25"].user_count).toBe(2);
      expect(result.items_per_user_buckets["26-50"].user_count).toBe(1);
      expect(result.items_by_age_bucket["0-1_months"].count).toBe(18);
      expect(result.items_by_age_bucket["1-3_months"].count).toBe(22);
      expect(result.items_by_age_bucket["3-6_months"].count).toBe(14);
      expect(result.items_by_age_bucket["6-12_months"].count).toBe(15);
      expect(result.items_by_age_bucket["12-18_months"].count).toBe(17);
      expect(result.items_by_age_bucket["18-24_months"].count).toBe(12);
      expect(result.items_by_age_bucket["24+_months"].count).toBe(6);
      expect(result.ttl_impact_simulation["3_months"]).toEqual({
        items_removed: 68,
        items_retained: 36,
        pct_items_removed: 65,
        users_with_all_data_removed: 0,
        users_with_data_retained: 8,
        items_per_user_after: expect.objectContaining({
          mean: 4.5,
          max: 10,
        }),
      });

      expect(result.ttl_impact_simulation["6_months"]).toEqual({
        items_removed: 47,
        items_retained: 57,
        pct_items_removed: 45,
        users_with_all_data_removed: 0,
        users_with_data_retained: 8,
        items_per_user_after: expect.objectContaining({
          mean: 7.125,
          max: 20,
        }),
      });

      expect(result.ttl_impact_simulation["12_months"]).toEqual({
        items_removed: 27,
        items_retained: 77,
        pct_items_removed: 26,
        users_with_all_data_removed: 0,
        users_with_data_retained: 8,
        items_per_user_after: expect.objectContaining({
          mean: 9.625,
          max: 30,
        }),
      });

      expect(result.ttl_impact_simulation["18_months"]).toEqual({
        items_removed: 12,
        items_retained: 92,
        pct_items_removed: 12,
        users_with_all_data_removed: 0,
        users_with_data_retained: 8,
        items_per_user_after: expect.objectContaining({
          mean: 11.5,
          max: 40,
        }),
      });

      expect(result.ttl_impact_simulation["24_months"]).toEqual({
        items_removed: 5,
        items_retained: 99,
        pct_items_removed: 5,
        users_with_all_data_removed: 0,
        users_with_data_retained: 8,
        items_per_user_after: expect.objectContaining({
          mean: 12.375,
          max: 45,
        }),
      });
    });
  });
});
