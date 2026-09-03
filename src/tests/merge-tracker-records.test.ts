import { describe, test, expect, beforeEach } from "vitest";
import { DynamoDBDocumentClient, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import "aws-sdk-client-mock-vitest";
import type { InactiveAccountTrackerRecord } from "../common/model.js";
import {
  computeMergedTrackerRecord,
  mergeTrackerRecords,
} from "../common/merge-tracker-records.js";

describe("computeMergedTrackerRecord (pure merge)", () => {
  type Record = Parameters<typeof computeMergedTrackerRecord>[0][number];

  const baseRecord = (overrides: Partial<Record> = {}): Record => ({
    commonSubjectId: "user-1",
    publicSubjectId: "public-1",
    dateForDeletion: "2030-01-01",
    status: "pending",
    statusLastUpdated: "2026-01-01T00:00:00.000Z",
    userLastActive: "2021-01-01T00:00:00.000Z",
    userLastActiveSource: "AUTH_EVENT",
    userLastActiveUpdated: "2026-01-01T00:00:00.000Z",
    hasSetupMfa: false,
    ...overrides,
  });

  test("throws when given an empty set of records", () => {
    expect(() => computeMergedTrackerRecord([])).toThrow(
      "cannot merge an empty set of tracker records"
    );
  });

  test("takes userLastActive group (incl. dateForDeletion/publicSubjectId) from the record with the newest userLastActiveUpdated", () => {
    const older = baseRecord({
      dateForDeletion: "2030-01-01",
      publicSubjectId: "old-public",
      userLastActive: "2021-01-01T00:00:00.000Z",
      userLastActiveSource: "OLD_SOURCE",
      userLastActiveSourceId: "old-id",
      userLastActiveUpdated: "2026-01-01T00:00:00.000Z",
    });
    const newer = baseRecord({
      dateForDeletion: "2031-06-01",
      publicSubjectId: "new-public",
      userLastActive: "2026-06-01T00:00:00.000Z",
      userLastActiveSource: "NEW_SOURCE",
      userLastActiveSourceId: "new-id",
      userLastActiveUpdated: "2026-06-01T00:00:00.000Z",
    });

    const merged = computeMergedTrackerRecord([older, newer]);

    expect(merged.userLastActive).toBe("2026-06-01T00:00:00.000Z");
    expect(merged.userLastActiveSource).toBe("NEW_SOURCE");
    expect(merged.userLastActiveSourceId).toBe("new-id");
    expect(merged.userLastActiveUpdated).toBe("2026-06-01T00:00:00.000Z");
    expect(merged.dateForDeletion).toBe("2031-06-01");
    expect(merged.publicSubjectId).toBe("new-public");
  });

  test("takes email group from the record with the newest emailAddressLastUpdated, independent of activity", () => {
    const newestActivity = baseRecord({
      userLastActiveUpdated: "2026-12-01T00:00:00.000Z",
      emailAddress: "stale@example.com",
      emailAddressSource: "STALE_EMAIL_SOURCE",
      emailAddressSourceId: "stale-email-id",
      emailAddressLastUpdated: "2020-01-01T00:00:00.000Z",
    });
    const newestEmail = baseRecord({
      userLastActiveUpdated: "2021-01-01T00:00:00.000Z",
      emailAddress: "fresh@example.com",
      emailAddressSource: "FRESH_EMAIL_SOURCE",
      emailAddressSourceId: "fresh-email-id",
      emailAddressLastUpdated: "2026-06-01T00:00:00.000Z",
    });

    const merged = computeMergedTrackerRecord([newestActivity, newestEmail]);

    expect(merged.emailAddress).toBe("fresh@example.com");
    expect(merged.emailAddressSource).toBe("FRESH_EMAIL_SOURCE");
    expect(merged.emailAddressSourceId).toBe("fresh-email-id");
    expect(merged.emailAddressLastUpdated).toBe("2026-06-01T00:00:00.000Z");
  });

  test("takes status from the record with the newest statusLastUpdated", () => {
    const older = baseRecord({ status: "pending", statusLastUpdated: "2026-01-01T00:00:00.000Z" });
    const newer = baseRecord({ status: "30DayWarningSent", statusLastUpdated: "2026-09-01T00:00:00.000Z" });

    const merged = computeMergedTrackerRecord([older, newer]);

    expect(merged.status).toBe("30DayWarningSent");
    expect(merged.statusLastUpdated).toBe("2026-09-01T00:00:00.000Z");
  });

  test("treats hasSetupMfa and hasUndeliverableEmailAddress as sticky-true across duplicates", () => {
    const a = baseRecord({ hasSetupMfa: false, hasUndeliverableEmailAddress: false, userLastActiveUpdated: "2026-06-01T00:00:00.000Z" });
    const b = baseRecord({ hasSetupMfa: true, hasUndeliverableEmailAddress: true, userLastActiveUpdated: "2020-01-01T00:00:00.000Z" });

    const merged = computeMergedTrackerRecord([a, b]);

    expect(merged.hasSetupMfa).toBe(true);
    expect(merged.hasUndeliverableEmailAddress).toBe(true);
  });

  test("omits the email group entirely when no duplicate has an email address", () => {
    const a = baseRecord();
    const b = baseRecord({ userLastActiveUpdated: "2026-06-01T00:00:00.000Z" });

    const merged = computeMergedTrackerRecord([a, b]);

    expect(merged.emailAddress).toBeUndefined();
    expect(merged.emailAddressLastUpdated).toBeUndefined();
    expect(merged.emailAddressSource).toBeUndefined();
    expect(merged.emailAddressSourceId).toBeUndefined();
  });

  test("returns the single record unchanged in shape when only one is provided", () => {
    const only = baseRecord({ emailAddress: "solo@example.com", emailAddressLastUpdated: "2026-01-01T00:00:00.000Z" });

    const merged = computeMergedTrackerRecord([only]);

    expect(merged.commonSubjectId).toBe("user-1");
    expect(merged.userLastActive).toBe("2021-01-01T00:00:00.000Z");
    expect(merged.emailAddress).toBe("solo@example.com");
    expect(merged.status).toBe("pending");
  });
});

describe("mergeTrackerRecords (query + merge + persist)", () => {
  type Record = InactiveAccountTrackerRecord;

  const dynamoMock = mockClient(DynamoDBDocumentClient);
  const docClient = dynamoMock as unknown as DynamoDBDocumentClient;
  const TABLE = "test-tracker-table";
  const USER_ID = "user-1";

  const baseRecord = (overrides: Partial<Record> = {}): Record => ({
    commonSubjectId: USER_ID,
    publicSubjectId: "public-1",
    dateForDeletion: "2030-01-01",
    status: "pending",
    statusLastUpdated: "2026-01-01T00:00:00.000Z",
    userLastActive: "2021-01-01T00:00:00.000Z",
    userLastActiveSource: "AUTH_EVENT",
    userLastActiveUpdated: "2026-01-01T00:00:00.000Z",
    hasSetupMfa: false,
    ...overrides,
  });

  // Seed the CommonSubjectIdIndex query with the rows the function will find for the user.
  const seedRows = (rows: Record[]): void => {
    dynamoMock
      .on(QueryCommand, {
        TableName: TABLE,
        IndexName: "CommonSubjectIdIndex",
      })
      .resolves({ Items: rows });
  };

  beforeEach(() => {
    dynamoMock.reset();
    dynamoMock.on(QueryCommand).resolves({ Items: [] });
    dynamoMock.on(TransactWriteCommand).resolves({});
  });

  test("queries the user's rows on the CommonSubjectIdIndex", async () => {
    seedRows([baseRecord()]);

    await mergeTrackerRecords(USER_ID, docClient, TABLE);

    expect(dynamoMock).toHaveReceivedCommandWith(QueryCommand, {
      TableName: TABLE,
      IndexName: "CommonSubjectIdIndex",
      KeyConditionExpression: "commonSubjectId = :id",
      ExpressionAttributeValues: { ":id": USER_ID },
    });
  });

  test("returns null and runs no transaction when the user has no rows", async () => {
    // Default query mock resolves { Items: [] }.
    const merged = await mergeTrackerRecords(USER_ID, docClient, TABLE);

    expect(merged).toBeNull();
    expect(dynamoMock).not.toHaveReceivedCommand(TransactWriteCommand);
  });

  test("returns the single row unchanged and runs no transaction", async () => {
    const only = baseRecord({ dateForDeletion: "2031-06-01", emailAddress: "solo@example.com" });
    seedRows([only]);

    const merged = await mergeTrackerRecords(USER_ID, docClient, TABLE);

    expect(merged).toEqual(only);
    expect(dynamoMock).not.toHaveReceivedCommand(TransactWriteCommand);
  });

  test("writes the merged record and deletes the stale duplicate rows in one transaction", async () => {
    const older = baseRecord({
      dateForDeletion: "2031-01-01",
      userLastActiveUpdated: "2026-01-01T00:00:00.000Z",
    });
    const newer = baseRecord({
      dateForDeletion: "2031-06-01",
      status: "30DayWarningSent",
      statusLastUpdated: "2026-06-01T00:00:00.000Z",
      userLastActive: "2026-06-01T00:00:00.000Z",
      userLastActiveUpdated: "2026-06-01T00:00:00.000Z",
    });
    seedRows([older, newer]);

    const merged = await mergeTrackerRecords(USER_ID, docClient, TABLE);

    // The newer-activity row owns dateForDeletion, so it is the surviving row.
    expect(merged?.dateForDeletion).toBe("2031-06-01");

    // Put the merged record to the surviving row; delete only the stale row.
    expect(dynamoMock).toHaveReceivedCommandWith(TransactWriteCommand, {
      TransactItems: expect.arrayContaining([
        expect.objectContaining({
          Put: expect.objectContaining({
            TableName: TABLE,
            Item: expect.objectContaining({
              commonSubjectId: USER_ID,
              dateForDeletion: "2031-06-01",
              status: "30DayWarningSent",
            }),
          }),
        }),
        expect.objectContaining({
          Delete: expect.objectContaining({
            TableName: TABLE,
            Key: { dateForDeletion: "2031-01-01", commonSubjectId: USER_ID },
          }),
        }),
      ]),
    });
    // The surviving row must NOT be deleted.
    expect(dynamoMock).toHaveReceivedCommandWith(TransactWriteCommand, {
      TransactItems: expect.not.arrayContaining([
        expect.objectContaining({
          Delete: expect.objectContaining({
            Key: { dateForDeletion: "2031-06-01", commonSubjectId: USER_ID },
          }),
        }),
      ]),
    });
  });

  test("deduplicates stale deletion dates so each stale row is deleted once", async () => {
    // Three rows, two of which share the same stale dateForDeletion.
    const staleA = baseRecord({ dateForDeletion: "2031-01-01", userLastActiveUpdated: "2026-01-01T00:00:00.000Z" });
    const staleB = baseRecord({ dateForDeletion: "2031-01-01", userLastActiveUpdated: "2026-02-01T00:00:00.000Z" });
    const winner = baseRecord({ dateForDeletion: "2031-06-01", userLastActiveUpdated: "2026-06-01T00:00:00.000Z" });
    seedRows([staleA, staleB, winner]);

    await mergeTrackerRecords(USER_ID, docClient, TABLE);

    const call = dynamoMock.commandCalls(TransactWriteCommand)[0];
    const transactItems = (call.args[0].input as { TransactItems: unknown[] }).TransactItems;
    const deletes = transactItems.filter((item) => (item as { Delete?: unknown }).Delete);

    expect(deletes).toHaveLength(1);
  });

  test("does not run a transaction when all duplicate rows share the merged dateForDeletion", async () => {
    const a = baseRecord({ dateForDeletion: "2031-06-01", userLastActiveUpdated: "2026-01-01T00:00:00.000Z" });
    const b = baseRecord({ dateForDeletion: "2031-06-01", userLastActiveUpdated: "2026-06-01T00:00:00.000Z" });
    seedRows([a, b]);

    const merged = await mergeTrackerRecords(USER_ID, docClient, TABLE);

    expect(merged?.dateForDeletion).toBe("2031-06-01");
    expect(dynamoMock).not.toHaveReceivedCommand(TransactWriteCommand);
  });

  test("propagates a transaction failure to the caller", async () => {
    const older = baseRecord({ dateForDeletion: "2031-01-01", userLastActiveUpdated: "2026-01-01T00:00:00.000Z" });
    const newer = baseRecord({ dateForDeletion: "2031-06-01", userLastActiveUpdated: "2026-06-01T00:00:00.000Z" });
    seedRows([older, newer]);
    dynamoMock.on(TransactWriteCommand).rejects(new Error("Transaction failed"));

    await expect(
      mergeTrackerRecords(USER_ID, docClient, TABLE)
    ).rejects.toThrow("Transaction failed");
  });
});
