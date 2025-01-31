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
});
