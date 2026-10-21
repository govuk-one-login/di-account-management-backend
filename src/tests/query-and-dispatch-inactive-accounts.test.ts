import { vi, describe, test, expect, beforeEach, afterEach } from "vitest";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { SQSClient, SendMessageBatchCommand } from "@aws-sdk/client-sqs";
import { Logger } from "@aws-lambda-powertools/logger";
import { mockClient } from "aws-sdk-client-mock";
import {
  handler,
  validateEvent,
  calculateTargetDate,
} from "../query-and-dispatch-inactive-accounts.js";
import type { Context } from "aws-lambda";

vi.mock("../common/iad-circuit-breaker.js", () => ({
  isIadCircuitBreakerTripped: vi.fn().mockResolvedValue(false),
  tripIadCircuitBreaker: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../common/iad-query-logic-hash.json", () => ({
  default: {
    hash: "test-hash",
    algorithm: "sha256",
    generatedAt: "1970-01-01T00:00:00.000Z",
  },
}));

vi.mock("../common/iadGetLatestForecastItemForDate.js", () => ({
  getLatestForecastItemForDate: vi.fn(),
}));

import {
  isIadCircuitBreakerTripped,
  tripIadCircuitBreaker,
} from "../common/iad-circuit-breaker.js";
import { getLatestForecastItemForDate } from "../common/iadGetLatestForecastItemForDate.js";

const dynamoMock = mockClient(DynamoDBDocumentClient);
const sqsMock = mockClient(SQSClient);

const mockRecord = {
  dateForDeletion: "2026-06-20",
  commonSubjectId: "user-1",
  publicSubjectId: "public-subject-1",
  emailAddress: "test@example.com",
  userLastActive: "2021-06-20T00:00:00.000Z",
  userLastActiveSource: "AUTH_AUTH_CODE_ISSUED",
  userLastActiveUpdated: "2026-01-01T00:00:00.000Z",
  emailAddressSource: "AUTH_AUTH_CODE_ISSUED",
  emailAddressLastUpdated: "2026-01-01T00:00:00.000Z",
  status: "pending",
  statusLastUpdated: "2026-01-01T00:00:00.000Z",
  hasSetupMfa: false,
};

describe("validateEvent", () => {
  test("throws when processName is unknown", () => {
    expect(() => validateEvent({ processName: "unknown" })).toThrow(
      "Unknown processName: unknown"
    );
  });

  test("throws when processName is empty", () => {
    expect(() => validateEvent({ processName: "" })).toThrow(
      "Unknown processName:"
    );
  });

  test("does not throw for valid input", () => {
    expect(() => validateEvent({ processName: "Warning30Day" })).not.toThrow();
  });

  test("does not throw when maxBatchSize is a positive integer", () => {
    expect(() =>
      validateEvent({ processName: "Warning30Day", maxBatchSize: 5 })
    ).not.toThrow();
  });

  test.each([0, -1, 2.5])(
    "throws when maxBatchSize is not a positive integer (%s)",
    (maxBatchSize) => {
      expect(() =>
        validateEvent({ processName: "Warning30Day", maxBatchSize })
      ).toThrow(`Invalid maxBatchSize: ${maxBatchSize}`);
    }
  );
});

describe("calculateTargetDate", () => {
  test("returns date in YYYY-MM-DD format offset by daysToDeletion", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-17T12:00:00.000Z"));

    expect(calculateTargetDate(3)).toBe("2026-06-20");
    expect(calculateTargetDate(0)).toBe("2026-06-17");
    expect(calculateTargetDate(-3)).toBe("2026-06-14");

    vi.useRealTimers();
  });
});

describe("handler", () => {
  beforeEach(() => {
    dynamoMock.reset();
    sqsMock.reset();
    process.env.TABLE_NAME = "inactive-accounts-table";
    process.env.WARNING_30_DAY_NOTIFICATION_QUEUE_URL =
      "https://sqs.eu-west-2.amazonaws.com/123/queue";
    process.env.WARNING_7_DAY_NOTIFICATION_QUEUE_URL =
      "https://sqs.eu-west-2.amazonaws.com/123/queue-7day";
    process.env.ACCOUNT_DELETION_QUEUE_URL =
      "https://sqs.eu-west-2.amazonaws.com/123/deletion-queue";
    process.env.FORECAST_TABLE_NAME = "forecast-table";
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.mocked(isIadCircuitBreakerTripped).mockResolvedValue(false);
    vi.mocked(tripIadCircuitBreaker).mockResolvedValue(undefined);
    vi.mocked(getLatestForecastItemForDate).mockReset();
  });

  test("aborts early and logs when circuit breaker is active", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-17T12:00:00.000Z"));

    vi.mocked(isIadCircuitBreakerTripped).mockResolvedValue(true);
    dynamoMock.on(QueryCommand).resolves({ Items: [mockRecord] });

    const infoSpy = vi.spyOn(Logger.prototype, "info");

    await handler({ processName: "Warning30Day" }, {} as Context);

    expect(sqsMock.commandCalls(SendMessageBatchCommand)).toHaveLength(0);
    expect(infoSpy).toHaveBeenCalledWith(
      "GuardrailAbortedQueryAndDispatchInactiveAccounts",
      {
        guardrailType: "CircuitBreakerAlreadyTripped",
        isCritical: "1",
        continueProcessingRecords: "0",
        isDryRun: "0",
        processName: "Warning30Day",
        targetDate: "2026-07-17",
        dispatchedBeforeAbort: 0,
      }
    );

    infoSpy.mockRestore();
    vi.useRealTimers();
  });

  test("continues dispatching when circuit breaker is inactive", async () => {
    vi.mocked(isIadCircuitBreakerTripped).mockResolvedValue(false);
    dynamoMock.on(QueryCommand).resolves({ Items: [mockRecord] });
    sqsMock
      .on(SendMessageBatchCommand)
      .resolves({ Successful: [], Failed: [] });

    await handler({ processName: "Warning30Day" }, {} as Context);

    expect(
      sqsMock.commandCalls(SendMessageBatchCommand).length
    ).toBeGreaterThan(0);
  });

  test("does not send messages when no records found", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [] });

    await handler({ processName: "Warning30Day" }, {} as Context);

    expect(sqsMock.commandCalls(SendMessageBatchCommand)).toHaveLength(0);
  });

  test("throws on invalid processName", async () => {
    await expect(
      handler({ processName: "unknown" }, {} as Context)
    ).rejects.toThrow("Unknown processName: unknown");
  });

  test("retries then logs error and continues when batch send keeps throwing", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [mockRecord] });
    sqsMock.on(SendMessageBatchCommand).rejects(new Error("SQS failure"));

    await expect(
      handler({ processName: "Warning30Day" }, {} as Context)
    ).resolves.toBeUndefined();

    // retryFunction attempts the send 3 times before giving up and logging.
    expect(sqsMock.commandCalls(SendMessageBatchCommand)).toHaveLength(3);
  });

  test("logs partial failures returned in batch response", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [mockRecord] });
    sqsMock.on(SendMessageBatchCommand).resolves({
      Failed: [{ Id: "0", Code: "InternalError", SenderFault: false }],
      Successful: [],
    });

    await expect(
      handler({ processName: "Warning30Day" }, {} as Context)
    ).resolves.toBeUndefined();

    expect(sqsMock.commandCalls(SendMessageBatchCommand)).toHaveLength(1);
  });

  test("dry run does not send any messages to SQS but still queries accounts", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [mockRecord] });
    sqsMock
      .on(SendMessageBatchCommand)
      .resolves({ Successful: [], Failed: [] });

    await handler({ processName: "DeletionDryRun" }, {} as Context);

    expect(sqsMock.commandCalls(SendMessageBatchCommand)).toHaveLength(0);
    expect(dynamoMock.commandCalls(QueryCommand)).toHaveLength(11);
  });

  test("dry run logs the count of eligible accounts found for each date", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-17T12:00:00.000Z"));

    const infoSpy = vi.spyOn(Logger.prototype, "info");

    // daysToDeletion[0] is 0 -> target date equals the system date.
    dynamoMock.on(QueryCommand).resolves({
      Items: [mockRecord, { ...mockRecord, commonSubjectId: "user-2" }],
    });

    await handler({ processName: "DeletionDryRun" }, {} as Context);

    expect(infoSpy).toHaveBeenCalledWith(
      "Dry Run DeletionDryRun: found 2 accounts for date 2026-06-17"
    );

    infoSpy.mockRestore();
    vi.useRealTimers();
  });

  test("DeleteAccount: disables IAD and returns early when actual count exceeds forecast", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-17T12:00:00.000Z"));

    vi.mocked(getLatestForecastItemForDate)
      .mockResolvedValueOnce({
        iadQueryLogicHash: {
          hash: "test-hash",
          algorithm: "sha256",
          generatedAt: "",
        },
        accountsToDelete: 3,
        dateForDeletion: "2026-06-17",
        forecastedAt: "",
        ttl: 0,
      })
      .mockResolvedValueOnce({
        iadQueryLogicHash: {
          hash: "test-hash",
          algorithm: "sha256",
          generatedAt: "",
        },
        accountsToDelete: 3,
        dateForDeletion: "2026-06-17",
        forecastedAt: "",
        ttl: 0,
      });
    dynamoMock
      .on(QueryCommand)
      .resolves({ Count: 5, ScannedCount: 5, Items: [] });

    const infoSpy = vi.spyOn(Logger.prototype, "info");

    await handler({ processName: "DeleteAccount" }, {} as Context);

    expect(tripIadCircuitBreaker).toHaveBeenCalledWith({
      guardrailType: "HomeToDeleteMoreThanForecast",
      processName: "DeleteAccount",
      targetDate: "2026-06-17",
      dispatchedBeforeAbort: 0,
      forecastedCount: 3,
      actualCount: 5,
      isDryRun: false,
    });
    expect(infoSpy).toHaveBeenCalledWith(
      "GuardrailAbortedQueryAndDispatchInactiveAccounts",
      {
        guardrailType: "HomeToDeleteMoreThanForecast",
        isCritical: "1",
        continueProcessingRecords: "0",
        isDryRun: "0",
        processName: "DeleteAccount",
        targetDate: "2026-06-17",
        dispatchedBeforeAbort: 0,
        forecastedCount: 3,
        actualCount: 5,
      }
    );
    expect(sqsMock.commandCalls(SendMessageBatchCommand)).toHaveLength(0);

    infoSpy.mockRestore();
    vi.useRealTimers();
  });

  test("DeleteAccount: proceeds normally when forecast matches actual count", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-17T12:00:00.000Z"));

    vi.mocked(getLatestForecastItemForDate).mockResolvedValue({
      iadQueryLogicHash: {
        hash: "test-hash",
        algorithm: "sha256",
        generatedAt: "",
      },
      accountsToDelete: 1,
      dateForDeletion: "2026-06-17",
      forecastedAt: "",
      ttl: 0,
    });
    dynamoMock
      .on(QueryCommand)
      .resolves({ Count: 1, ScannedCount: 1, Items: [mockRecord] });
    sqsMock
      .on(SendMessageBatchCommand)
      .resolves({ Successful: [], Failed: [] });

    await handler({ processName: "DeleteAccount" }, {} as Context);

    expect(tripIadCircuitBreaker).not.toHaveBeenCalled();
    expect(
      sqsMock.commandCalls(SendMessageBatchCommand).length
    ).toBeGreaterThan(0);

    vi.useRealTimers();
  });

  test("DeleteAccount: proceeds normally when forecast exceeds actual count", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-17T12:00:00.000Z"));

    vi.mocked(getLatestForecastItemForDate).mockResolvedValue({
      iadQueryLogicHash: {
        hash: "test-hash",
        algorithm: "sha256",
        generatedAt: "",
      },
      accountsToDelete: 5,
      dateForDeletion: "2026-06-17",
      forecastedAt: "",
      ttl: 0,
    });
    dynamoMock
      .on(QueryCommand)
      .resolves({ Count: 3, ScannedCount: 3, Items: [mockRecord] });
    sqsMock
      .on(SendMessageBatchCommand)
      .resolves({ Successful: [], Failed: [] });

    await handler({ processName: "DeleteAccount" }, {} as Context);

    expect(tripIadCircuitBreaker).not.toHaveBeenCalled();
    expect(
      sqsMock.commandCalls(SendMessageBatchCommand).length
    ).toBeGreaterThan(0);

    vi.useRealTimers();
  });

  test.each([
    {
      label: "hash differs",
      forecastItem: {
        iadQueryLogicHash: {
          hash: "old-hash",
          algorithm: "sha256",
          generatedAt: "",
        },
        accountsToDelete: 1,
        dateForDeletion: "2026-06-17",
        forecastedAt: "",
        ttl: 0,
      },
    },
    {
      label: "algorithm differs",
      forecastItem: {
        iadQueryLogicHash: {
          hash: "test-hash",
          algorithm: "md5",
          generatedAt: "",
        },
        accountsToDelete: 1,
        dateForDeletion: "2026-06-17",
        forecastedAt: "",
        ttl: 0,
      },
    },
    {
      label: "no forecast item stored",
      forecastItem: undefined,
    },
  ])(
    "DeleteAccount: aborts and logs when query logic hash mismatches ($label)",
    async ({ forecastItem }) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-06-17T12:00:00.000Z"));

      vi.mocked(getLatestForecastItemForDate).mockResolvedValue(forecastItem);

      const infoSpy = vi.spyOn(Logger.prototype, "info");

      await handler({ processName: "DeleteAccount" }, {} as Context);

      expect(tripIadCircuitBreaker).toHaveBeenCalledWith(
        expect.objectContaining({
          guardrailType: "ForecastQueryLogicHashMismatch",
          processName: "DeleteAccount",
          targetDate: "2026-06-17",
          dispatchedBeforeAbort: 0,
        })
      );
      expect(infoSpy).toHaveBeenCalledWith(
        "GuardrailAbortedQueryAndDispatchInactiveAccounts",
        expect.objectContaining({
          guardrailType: "ForecastQueryLogicHashMismatch",
          processName: "DeleteAccount",
          targetDate: "2026-06-17",
          dispatchedBeforeAbort: 0,
        })
      );
      expect(sqsMock.commandCalls(SendMessageBatchCommand)).toHaveLength(0);

      infoSpy.mockRestore();
      vi.useRealTimers();
    }
  );

  test("DeleteAccount: does not call getLatestForecastItemForDate for non-DeleteAccount processes", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [mockRecord] });
    sqsMock
      .on(SendMessageBatchCommand)
      .resolves({ Successful: [], Failed: [] });

    await handler({ processName: "Warning30Day" }, {} as Context);

    expect(getLatestForecastItemForDate).not.toHaveBeenCalled();
  });

  test("dry run reports zero eligible accounts when none match the allowed statuses", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-17T12:00:00.000Z"));

    const infoSpy = vi.spyOn(Logger.prototype, "info");

    dynamoMock.on(QueryCommand).resolves({
      Items: [{ ...mockRecord, status: "deleting" }],
    });

    await handler({ processName: "DeletionDryRun" }, {} as Context);

    expect(sqsMock.commandCalls(SendMessageBatchCommand)).toHaveLength(0);
    expect(infoSpy).toHaveBeenCalledWith(
      "Dry Run DeletionDryRun: found 0 accounts for date 2026-06-17"
    );

    infoSpy.mockRestore();
    vi.useRealTimers();
  });

  describe("maxBatchSize", () => {
    const countEntriesDispatched = (): number =>
      sqsMock
        .commandCalls(SendMessageBatchCommand)
        .reduce(
          (sum, call) => sum + (call.args[0].input.Entries?.length ?? 0),
          0
        );

    test("dispatches no more than maxBatchSize records within a single page", async () => {
      // 25 eligible records in one page, cap at 12.
      const records = Array.from({ length: 25 }, (_, i) => ({
        ...mockRecord,
        commonSubjectId: `user-${i}`,
      }));
      dynamoMock.on(QueryCommand).resolves({ Items: records });
      sqsMock
        .on(SendMessageBatchCommand)
        .resolves({ Successful: [], Failed: [] });

      await handler(
        { processName: "Warning7Day", maxBatchSize: 12 },
        {} as Context
      );

      expect(countEntriesDispatched()).toBe(12);
    });

    test("stops dispatching across pages once maxBatchSize is reached", async () => {
      const page = (startIndex: number) =>
        Array.from({ length: 10 }, (_, i) => ({
          ...mockRecord,
          commonSubjectId: `user-${startIndex + i}`,
        }));

      // Two pages of 10; cap at 15 means the first page (10) dispatches
      // fully and the second page is trimmed to 5, then paging stops.
      dynamoMock
        .on(QueryCommand)
        .resolvesOnce({
          Items: page(0),
          LastEvaluatedKey: { dateForDeletion: "x", commonSubjectId: "user-9" },
        })
        .resolves({ Items: page(10) });
      sqsMock
        .on(SendMessageBatchCommand)
        .resolves({ Successful: [], Failed: [] });

      await handler(
        { processName: "Warning7Day", maxBatchSize: 15 },
        {} as Context
      );

      expect(countEntriesDispatched()).toBe(15);
      // Only the first page needed to be fetched beyond the initial query;
      // paging halts once the cap is hit rather than draining every page.
      expect(dynamoMock.commandCalls(QueryCommand)).toHaveLength(2);
    });

    test("stops processing further dates once maxBatchSize is reached", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-06-17T12:00:00.000Z"));

      vi.mocked(getLatestForecastItemForDate).mockResolvedValue({
        iadQueryLogicHash: {
          hash: "test-hash",
          algorithm: "sha256",
          generatedAt: "",
        },
        accountsToDelete: 1000,
        dateForDeletion: "2026-06-17",
        forecastedAt: "",
        ttl: 0,
      });

      // DeleteAccount iterates 15 dates. Each date returns 10 eligible
      // records; a cap of 10 should be satisfied by the first date alone.
      const records = Array.from({ length: 10 }, (_, i) => ({
        ...mockRecord,
        commonSubjectId: `user-${i}`,
      }));
      dynamoMock
        .on(QueryCommand)
        .resolves({ Count: 10, ScannedCount: 10, Items: records });
      sqsMock
        .on(SendMessageBatchCommand)
        .resolves({ Successful: [], Failed: [] });

      const infoSpy = vi.spyOn(Logger.prototype, "info");

      await handler(
        { processName: "DeleteAccount", maxBatchSize: 10 },
        {} as Context
      );

      expect(countEntriesDispatched()).toBe(10);
      expect(infoSpy).toHaveBeenCalledWith(
        "Reached maxBatchSize of 10; stopping dispatch for DeleteAccount",
        expect.objectContaining({
          maxBatchSize: 10,
          processName: "DeleteAccount",
          dispatched: 10,
          residualOnStoppingPage: expect.any(Number),
        })
      );

      infoSpy.mockRestore();
      vi.useRealTimers();
    });

    test("dispatches all records when maxBatchSize is omitted", async () => {
      const records = Array.from({ length: 25 }, (_, i) => ({
        ...mockRecord,
        commonSubjectId: `user-${i}`,
      }));
      dynamoMock.on(QueryCommand).resolves({ Items: records });
      sqsMock
        .on(SendMessageBatchCommand)
        .resolves({ Successful: [], Failed: [] });

      await handler({ processName: "Warning7Day" }, {} as Context);

      expect(countEntriesDispatched()).toBe(25);
    });

    test("does not apply maxBatchSize to a dry run", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-06-17T12:00:00.000Z"));

      const infoSpy = vi.spyOn(Logger.prototype, "info");

      dynamoMock.on(QueryCommand).resolves({
        Items: Array.from({ length: 5 }, (_, i) => ({
          ...mockRecord,
          commonSubjectId: `user-${i}`,
        })),
      });

      await handler(
        { processName: "DeletionDryRun", maxBatchSize: 2 },
        {} as Context
      );

      expect(sqsMock.commandCalls(SendMessageBatchCommand)).toHaveLength(0);
      // All 11 dates still queried; the cap only governs real dispatch.
      expect(infoSpy).toHaveBeenCalledWith(
        "Dry Run DeletionDryRun: found 5 accounts for date 2026-06-17"
      );

      infoSpy.mockRestore();
      vi.useRealTimers();
    });
  });
});
