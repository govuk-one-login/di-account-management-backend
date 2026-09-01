import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { createHash } from "node:crypto";
import { handler } from "../trigger-inactive-account-process.js";

const dynamoMock = mockClient(DynamoDBDocumentClient);
const lambdaMock = mockClient(LambdaClient);

const emailAddress = "test@example.com";
const processName = "Warning30Day";
const expectedCommonSubjectId = `test-${createHash("sha256").update(emailAddress).digest("hex")}`;

describe("TriggerInactiveAccountProcess handler", () => {
  beforeEach(() => {
    process.env.INACTIVE_ACCOUNT_TRACKER_TABLE_NAME = "test-table";
    process.env.QUERY_AND_DISPATCH_FUNCTION_NAME = "test-dispatch-fn";
    dynamoMock.reset();
    lambdaMock.reset();
    dynamoMock.on(PutCommand).resolves({});
    lambdaMock.on(InvokeCommand).resolves({});
  });

  afterEach(() => {
    delete process.env.INACTIVE_ACCOUNT_TRACKER_TABLE_NAME;
    delete process.env.QUERY_AND_DISPATCH_FUNCTION_NAME;
  });

  test("throws when emailAddress is missing", async () => {
    await expect(handler({ emailAddress: "", processName })).rejects.toThrow(
      "emailAddress and processName are required"
    );
  });

  test("throws when processName is missing", async () => {
    await expect(handler({ emailAddress, processName: "" })).rejects.toThrow(
      "emailAddress and processName are required"
    );
  });

  test("throws when processName is unknown", async () => {
    await expect(
      handler({ emailAddress, processName: "UnknownProcess" })
    ).rejects.toThrow("Unknown processName: UnknownProcess");
  });

  test("throws when status is not valid for the given processName", async () => {
    await expect(
      handler({ emailAddress, processName: "Warning30Day", status: "deleting" })
    ).rejects.toThrow(
      `Status "deleting" is not valid for process "Warning30Day"`
    );
  });

  test("inserts record into DynamoDB with correct shape", async () => {
    await handler({ emailAddress, processName });

    expect(dynamoMock).toHaveReceivedCommandWith(PutCommand, {
      TableName: "test-table",
      Item: expect.objectContaining({
        commonSubjectId: expectedCommonSubjectId,
        publicSubjectId: `public-${expectedCommonSubjectId}`,
        emailAddress,
        emailAddressSource: "MANUAL_TEST",
        userLastActiveSource: "MANUAL_TEST",
        status: "pending",
        hasSetupMfa: false,
      }),
    });
  });

  test("invokes query-and-dispatch lambda with processName and manualTestOnly flag", async () => {
    await handler({ emailAddress, processName });

    expect(lambdaMock).toHaveReceivedCommandWith(InvokeCommand, {
      FunctionName: "test-dispatch-fn",
      InvocationType: "RequestResponse",
      Payload: Buffer.from(
        JSON.stringify({ processName, manualTestOnly: true })
      ),
    });
  });

  test("uses dateForDeletion override when provided", async () => {
    const dateForDeletion = "2099-01-01";
    await handler({ emailAddress, processName, dateForDeletion });

    expect(dynamoMock).toHaveReceivedCommandWith(PutCommand, {
      TableName: "test-table",
      Item: expect.objectContaining({ dateForDeletion }),
    });
  });

  test("calculates dateForDeletion from processConfig when not provided", async () => {
    await handler({ emailAddress, processName: "DeleteAccount" });

    const today = new Date().toISOString().split("T")[0];
    expect(dynamoMock).toHaveReceivedCommandWith(PutCommand, {
      TableName: "test-table",
      Item: expect.objectContaining({ dateForDeletion: today }),
    });
  });

  test("uses provided status instead of default", async () => {
    await handler({
      emailAddress,
      processName: "Warning7Day",
      status: "30DayWarningSent",
    });

    expect(dynamoMock).toHaveReceivedCommandWith(PutCommand, {
      TableName: "test-table",
      Item: expect.objectContaining({ status: "30DayWarningSent" }),
    });
  });

  test("includes hasUndeliverableEmailAddress when true", async () => {
    await handler({
      emailAddress,
      processName,
      hasUndeliverableEmailAddress: true,
    });

    expect(dynamoMock).toHaveReceivedCommandWith(PutCommand, {
      TableName: "test-table",
      Item: expect.objectContaining({ hasUndeliverableEmailAddress: true }),
    });
  });

  test("omits hasUndeliverableEmailAddress when false", async () => {
    await handler({
      emailAddress,
      processName,
      hasUndeliverableEmailAddress: false,
    });

    expect(dynamoMock).toHaveReceivedCommandWith(PutCommand, {
      TableName: "test-table",
      Item: expect.not.objectContaining({
        hasUndeliverableEmailAddress: expect.anything(),
      }),
    });
  });
});
