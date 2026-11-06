import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import type { APIGatewayProxyEvent, Context } from "aws-lambda";
import type { APIGatewayProxyHandler } from "../common/types.js";

vi.mock("node:crypto", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:crypto")>()),
  randomUUID: vi.fn().mockReturnValue("test-uuid-1234"),
}));

vi.mock("../common/metrics.js", () => ({
  initMetrics: vi.fn().mockReturnValue({}),
  metricsAPIGatewayProxyHandlerWrapper: (
    _metrics: unknown,
    fn: APIGatewayProxyHandler
  ) => fn,
}));

import { handler } from "../integration-test-stub-api-handler.js";

const dynamoMock = mockClient(DynamoDBDocumentClient);

const TABLE_NAME = "integration-test-stub-api-outputs-table";
const UUID = "test-uuid-1234";
const NOW_MS = 1_700_000_000_000;
const NOW_S = Math.floor(NOW_MS / 1000);

const baseEvent = {
  headers: {},
  multiValueHeaders: {},
  httpMethod: "POST",
  path: "/notify",
  body: null,
  queryStringParameters: null,
  multiValueQueryStringParameters: null,
  pathParameters: null,
  stageVariables: null,
  requestContext: {} as APIGatewayProxyEvent["requestContext"],
  resource: "",
  isBase64Encoded: false,
} as APIGatewayProxyEvent;

describe("integration-test-stub-api-handler", () => {
  beforeEach(() => {
    dynamoMock.reset();
    process.env.INTEGRATION_TEST_STUB_API_OUTPUTS_TABLE_NAME = TABLE_NAME;
    vi.spyOn(Date, "now").mockReturnValue(NOW_MS);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("saves the event to DynamoDB with correct fields", async () => {
    await handler(baseEvent, {} as Context);

    expect(dynamoMock).toHaveReceivedCommandWith(PutCommand, {
      TableName: TABLE_NAME,
      Item: {
        id: UUID,
        allItemsId: "an_item",
        createdAt: NOW_S,
        expiresAt: NOW_S + 86400,
        event: expect.objectContaining({ path: "/notify" }),
      },
    });
  });

  it("returns 200", async () => {
    const result = await handler(baseEvent, {} as Context);
    expect(result).toEqual({ statusCode: 200, body: "" });
  });

  it("calls DynamoDB PutCommand exactly once per request", async () => {
    await handler(baseEvent, {} as Context);
    expect(dynamoMock.commandCalls(PutCommand)).toHaveLength(1);
  });
});
