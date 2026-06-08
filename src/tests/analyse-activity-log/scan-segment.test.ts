import { describe, test, expect, beforeEach } from "vitest";
import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { scanSegment } from "../../analyse-activity-log/scan-segment.js";
import {
  AgeThresholds,
  ageThresholdsFromNow,
  CounterIndex,
} from "../../analyse-activity-log/age-thresholds.js";

const dynamoMock = mockClient(DynamoDBClient);

const NOW_SECONDS = 1700000000;

const thresholds: AgeThresholds = ageThresholdsFromNow(NOW_SECONDS);

const makeItem = (userId: string, timestamp: number) => ({
  user_id: { S: userId },
  timestamp: { N: String(timestamp) },
});

describe("scanSegment", () => {
  beforeEach(() => {
    dynamoMock.reset();
  });

  test("empty segment returns zero counts", async () => {
    dynamoMock.on(ScanCommand).resolves({ Items: [] });

    const result = await scanSegment(
      dynamoMock as unknown as DynamoDBClient,
      "table",
      0,
      1,
      thresholds
    );

    expect(result.perUserCounters).toHaveLength(0);
  });

  test("single-item user", async () => {
    dynamoMock.on(ScanCommand).resolves({
      Items: [makeItem("user-a", NOW_SECONDS - 10)],
    });

    const result = await scanSegment(
      dynamoMock as unknown as DynamoDBClient,
      "table",
      0,
      1,
      thresholds
    );

    expect(result.perUserCounters).toHaveLength(1);
    expect(result.perUserCounters[0][CounterIndex.TOTAL]).toBe(1);
  });

  test("3 users across 2 pages with middle user spanning page boundary", async () => {
    dynamoMock
      .on(ScanCommand)
      .resolvesOnce({
        Items: [
          makeItem("user-a", NOW_SECONDS - 10),
          makeItem("user-a", NOW_SECONDS - 20),
          makeItem("user-b", NOW_SECONDS - 10),
        ],
        LastEvaluatedKey: { user_id: { S: "user-b" } },
      })
      .resolvesOnce({
        Items: [
          makeItem("user-b", NOW_SECONDS - 30),
          makeItem("user-c", NOW_SECONDS - 10),
        ],
      });

    const result = await scanSegment(
      dynamoMock as unknown as DynamoDBClient,
      "table",
      0,
      1,
      thresholds
    );

    expect(result.perUserCounters).toHaveLength(3);
    expect(result.perUserCounters[0][CounterIndex.TOTAL]).toBe(2);
    expect(result.perUserCounters[1][CounterIndex.TOTAL]).toBe(2);
    expect(result.perUserCounters[2][CounterIndex.TOTAL]).toBe(1);
  });

  test("age bucket counting at threshold boundaries", async () => {
    const fresh = NOW_SECONDS - 10;
    const exactly1m = thresholds[0];
    const between1and3m = thresholds[0] - 10;
    const between3and6m = thresholds[1] - 10;
    const between6and12m = thresholds[2] - 10;
    const between12and18m = thresholds[3] - 10;
    const between18and24m = thresholds[4] - 10;
    const older24m = thresholds[5] - 10;

    dynamoMock.on(ScanCommand).resolves({
      Items: [
        makeItem("user-a", fresh),
        makeItem("user-a", exactly1m),
        makeItem("user-a", between1and3m),
        makeItem("user-a", between3and6m),
        makeItem("user-a", between6and12m),
        makeItem("user-a", between12and18m),
        makeItem("user-a", between18and24m),
        makeItem("user-a", older24m),
      ],
    });

    const result = await scanSegment(
      dynamoMock as unknown as DynamoDBClient,
      "table",
      0,
      1,
      thresholds
    );

    expect(result.perUserCounters).toHaveLength(1);
    expect(result.perUserCounters[0][CounterIndex.TOTAL]).toBe(8);
    expect(result.perUserCounters[0][CounterIndex.OLDER_1M]).toBe(7);
    expect(result.perUserCounters[0][CounterIndex.OLDER_3M]).toBe(5);
    expect(result.perUserCounters[0][CounterIndex.OLDER_6M]).toBe(4);
    expect(result.perUserCounters[0][CounterIndex.OLDER_12M]).toBe(3);
    expect(result.perUserCounters[0][CounterIndex.OLDER_18M]).toBe(2);
    expect(result.perUserCounters[0][CounterIndex.OLDER_24M]).toBe(1);
    expect(result.exclusiveAgeBuckets).toEqual([1, 2, 1, 1, 1, 1, 1]);
  });
});
