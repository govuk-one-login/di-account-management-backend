import { describe, test, expect } from "vitest";
import { handler } from "../../analyse-activity-log/handler.js";
import { Context } from "aws-lambda";

const mockContext = {} as Context;

describe("analyse-activity-log handler", () => {
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
    await expect(handler({ totalSegments: 1.5 }, mockContext)).rejects.toThrow(
      "totalSegments must be a positive integer"
    );
  });

  test("does not throw with valid totalSegments", async () => {
    await expect(
      handler({ totalSegments: 5 }, mockContext)
    ).resolves.not.toThrow();
  });
});
