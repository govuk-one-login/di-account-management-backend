import { vi, describe, test, expect, beforeEach } from "vitest";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { dateForDeletionIs27October } from "../../common/iadGuards/dateForDeletionIs27October.js";
import "aws-sdk-client-mock-vitest";

const dynamoMock = mockClient(DynamoDBDocumentClient);

describe("dateForDeletionIs27October", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dynamoMock.reset();
    process.env.INACTIVE_ACCOUNT_TRACKER_TABLE_NAME = "test-inactive-account-table";
  });

  test("returns continue: 'Continue' when dateForDeletion is not 2026-10-27", async () => {
    const result = await dateForDeletionIs27October("user-123", "oldverifyuser@asdf","2026-10-28");

    expect(result).toEqual({ continue: 'Continue', guardName: "DateForDeletionIs27October" });
  });

  test("returns continue: 'ContinueWithoutPerformingActions' when dateForDeletion is 2026-10-27", async () => {
    const result = await dateForDeletionIs27October("user-123", "oldverifyuser@asdf","2026-10-27");

    expect(result).toEqual({ continue: 'ContinueWithoutPerformingActions', guardName: "DateForDeletionIs27October" });
  });
});
