import { describe, test, expect, beforeEach } from "vitest";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { queryAccountsByDate } from "../common/query-inactive-accounts.js";
import type { InactiveAccountTrackerRecord } from "../common/model.js";

const dynamoMock = mockClient(DynamoDBDocumentClient);

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

describe("queryAccountsByDate", () => {
  beforeEach(() => {
    dynamoMock.reset();
  });

  test("yields pages across paginated results", async () => {
    dynamoMock
      .on(QueryCommand)
      .resolvesOnce({
        Items: [mockRecord],
        LastEvaluatedKey: { dateForDeletion: "2026-06-20", commonSubjectId: "user-1" },
      })
      .resolvesOnce({
        Items: [{ ...mockRecord, commonSubjectId: "user-2" }],
        LastEvaluatedKey: undefined,
      });

    const pages: InactiveAccountTrackerRecord[][] = [];
    for await (const page of queryAccountsByDate("table", "2026-06-20")) {
      pages.push(page);
    }
    expect(pages).toHaveLength(2);
    expect(pages.flat()).toHaveLength(2);
    expect(dynamoMock.commandCalls(QueryCommand)).toHaveLength(2);
  });

  test("yields nothing when no results", async () => {
    dynamoMock.on(QueryCommand).resolves({ Items: [] });

    const pages: InactiveAccountTrackerRecord[][] = [];
    for await (const page of queryAccountsByDate("table", "2026-06-20")) {
      pages.push(page);
    }
    expect(pages).toHaveLength(0);
  });
});
