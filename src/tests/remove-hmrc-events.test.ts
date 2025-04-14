import "aws-sdk-client-mock-jest";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { handler } from "../remove-hmrc-events";

const dynamoMock = mockClient(DynamoDBDocumentClient);

describe("handler", () => {
  beforeEach(() => {
    dynamoMock.reset();
    process.env.TABLE_NAME = "TABLE_NAME";
    process.env.LAST_EVALUATED_KEY =
      "5d100f41-66bc-48e8-a7f9-33b82dccffdd,user_id";
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should delete items matching the filter expression", async () => {
    const mockItemsToDelete = [{ user_id: "user1" }, { user_id: "user2" }];
    dynamoMock.on(ScanCommand).resolves({ Items: mockItemsToDelete });
    dynamoMock.on(BatchWriteCommand).resolves({});

    await handler();

    expect(dynamoMock).toHaveReceivedCommandWith(ScanCommand, {
      TableName: process.env.TABLE_NAME,
      FilterExpression: "NOT begins_with(user_id, :urn)",
      ExpressionAttributeValues: {
        ":urn": "urn:",
      },
    });
    expect(dynamoMock).toHaveReceivedCommandWith(BatchWriteCommand, {
      RequestItems: {
        TABLE_NAME: expect.arrayContaining(
          mockItemsToDelete.map((item) => ({
            DeleteRequest: {
              Key: {
                user_id: item.user_id,
              },
            },
          }))
        ),
      },
    });
  });

  it("should handle cases where no items match the filter", async () => {
    dynamoMock.on(ScanCommand).resolves({ Items: [] });
    await handler();
    expect(dynamoMock).toHaveReceivedCommandWith(ScanCommand, {
      TableName: process.env.TABLE_NAME,
      FilterExpression: "NOT begins_with(user_id, :urn)",
      ExpressionAttributeValues: {
        ":urn": "urn:",
      },
    });
    expect(dynamoMock).not.toHaveReceivedCommand(BatchWriteCommand);
  });

  it("should handle errors gracefully", async () => {
    const mockError = new Error("DynamoDB error");
    dynamoMock.on(ScanCommand).rejects(mockError);
    const result = await handler();
    expect(dynamoMock).toHaveReceivedCommandWith(ScanCommand, {
      TableName: process.env.TABLE_NAME,
      FilterExpression: "NOT begins_with(user_id, :urn)",
      ExpressionAttributeValues: {
        ":urn": "urn:",
      },
    });
    expect(result).toEqual({
      statusCode: 500,
      body: "An error occurred during the process.",
    });
  });

  it("should not delete users with user_ids starting with 'urn:'", async () => {
    const mockItems = [
      { user_id: "urn:user1" },
      { user_id: "user2" },
      { user_id: "urn:user3" },
    ];
    dynamoMock.on(ScanCommand).resolves({ Items: mockItems });
    dynamoMock.on(BatchWriteCommand).resolves({});
    await handler();
    expect(dynamoMock).toHaveReceivedCommandWith(ScanCommand, {
      TableName: process.env.TABLE_NAME,
      FilterExpression: "NOT begins_with(user_id, :urn)",
      ExpressionAttributeValues: {
        ":urn": "urn:",
      },
    });
    expect(dynamoMock).toHaveReceivedCommandWith(BatchWriteCommand, {
      RequestItems: {
        TABLE_NAME: expect.arrayContaining([
          {
            DeleteRequest: {
              Key: {
                user_id: "user2",
              },
            },
          },
        ]),
      },
    });
  });

  it("should handle pagination and delete all items matching the filter", async () => {
    const mockItemsToDelete = [
      { user_id: "user1" },
      { user_id: "user2" },
      { user_id: "user3" },
      { user_id: "user4" },
      { user_id: "user5" },
    ];
    const batchSize = 25;
    const numBatches = Math.ceil(mockItemsToDelete.length / batchSize);

    for (let i = 0; i < numBatches; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, mockItemsToDelete.length);
      dynamoMock.on(ScanCommand).resolvesOnce({
        Items: mockItemsToDelete.slice(start, end),
        LastEvaluatedKey:
          end < mockItemsToDelete.length
            ? { user_id: mockItemsToDelete[end].user_id }
            : undefined,
      });
    }

    dynamoMock.on(BatchWriteCommand).resolves({});

    await handler();

    expect(dynamoMock.commandCalls(ScanCommand).length).toBe(numBatches);
    expect(dynamoMock.commandCalls(BatchWriteCommand).length).toBe(numBatches);

    for (let i = 0; i < numBatches; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, mockItemsToDelete.length);
      expect(dynamoMock).toHaveReceivedCommandWith(BatchWriteCommand, {
        RequestItems: {
          TABLE_NAME: expect.arrayContaining(
            mockItemsToDelete.slice(start, end).map((item) => ({
              DeleteRequest: {
                Key: {
                  user_id: item.user_id,
                },
              },
            }))
          ),
        },
      });
    }
  });
});
