import { describe, it, expect, vi, beforeEach } from "vitest";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { mockClient } from "aws-sdk-client-mock";
import { handler } from "../publish-account-deletion.js";
import { Context, DynamoDBStreamEvent } from "aws-lambda";

const snsMock = mockClient(SNSClient);

describe("publish-account-deletion", () => {
  const TOPIC_ARN = "arn:aws:sns:eu-west-2:123456789012:UserAccountDeletion";

  beforeEach(() => {
    snsMock.reset();
    process.env.TOPIC_ARN = TOPIC_ARN;
  });

  const createEvent = (userId?: string): DynamoDBStreamEvent =>
    ({
      Records: [
        {
          dynamodb: {
            NewImage: {
              event: {
                M: {
                  event_name: { S: "AUTH_DELETE_ACCOUNT" },
                  timestamp: { N: "1666169856" },
                  user: {
                    M: {
                      ...(userId ? { user_id: { S: userId } } : {}),
                    },
                  },
                },
              },
            },
          },
        },
      ],
    }) as unknown as DynamoDBStreamEvent;

  it("publishes user_id to the SNS topic", async () => {
    snsMock.on(PublishCommand).resolves({});

    await handler(createEvent("test-user-id"), {} as Context);

    expect(snsMock).toHaveReceivedCommandWith(PublishCommand, {
      TopicArn: TOPIC_ARN,
      Message: JSON.stringify({ user_id: "test-user-id" }),
    });
  });

  it("throws an error when user_id is missing", async () => {
    await expect(
      handler(createEvent(undefined), {} as Context)
    ).rejects.toThrow("user_id is missing from the event");
  });

  it("throws when TOPIC_ARN is not set", async () => {
    delete process.env.TOPIC_ARN;

    await expect(
      handler(createEvent("test-user-id"), {} as Context)
    ).rejects.toThrow();
  });
});
