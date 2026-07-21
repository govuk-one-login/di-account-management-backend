import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { retryFunction } from "../common/retry-function.js";

const mockLogger = vi.hoisted(() => ({
  warn: vi.fn(),
}));

vi.mock("@aws-lambda-powertools/logger", () => ({
  Logger: class {
    warn = mockLogger.warn;
  },
}));

describe("retryFunction", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should resolve immediately if the function succeeds on the first attempt", async () => {
    const mockFn = vi.fn().mockResolvedValue("Success");
    const result = await retryFunction(mockFn, { functionName: "test function" });
    expect(result).toBe("Success");
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it("should retry and resolve if an early attempt fails but a later attempt succeeds", async () => {
    const mockFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("First Fail"))
      .mockRejectedValueOnce(new Error("Second Fail"))
      .mockResolvedValueOnce("Third success");

    const promise = retryFunction(mockFn, { retries: 3, delay: 300, functionName: "test function" });

    await vi.advanceTimersByTimeAsync(300);
    await vi.advanceTimersByTimeAsync(300);

    const result = await promise;

    expect(result).toBe("Third success");
    expect(mockFn).toHaveBeenCalledTimes(3);
    expect(mockLogger.warn).toHaveBeenCalledTimes(2);
    expect(mockLogger.warn).toHaveBeenNthCalledWith(
      1,
      "test function failed (attempt 1 out of 3)."
    );
  });

  it("should throw error after exhausting all retries", async () => {
    const finalError = new Error("Permanent Failure");
    const mockFn = vi.fn().mockRejectedValue(finalError);

    const promise = retryFunction(mockFn, { retries: 5, delay: 100, functionName: "my test func" });

    const [, errorReason] = await Promise.all([
      vi.runAllTimersAsync(),
      promise.catch((err) => err),
    ]);

    expect(errorReason).toEqual(finalError);
    expect(mockFn).toHaveBeenCalledTimes(5);
    expect(mockLogger.warn).toHaveBeenCalledTimes(5);
    expect(mockLogger.warn).toHaveBeenNthCalledWith(
      5,
      "my test func failed (attempt 5 out of 5)."
    );
  });

  it("should use default retries and delay when only functionName is provided", async () => {
    const mockFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("Fail 1"))
      .mockResolvedValueOnce("Success");

    const promise = retryFunction(mockFn, { functionName: "MyTestOperation" });

    await vi.advanceTimersByTimeAsync(300);

    const result = await promise;

    expect(result).toBe("Success");
    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(mockLogger.warn).toHaveBeenNthCalledWith(
      1,
      "MyTestOperation failed (attempt 1 out of 3)."
    );
  });
});
