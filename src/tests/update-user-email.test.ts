import { describe, it, expect, beforeEach } from "vitest";
import { handler } from "../update-user-email.js";
import { Context, DynamoDBStreamEvent } from "aws-lambda";

describe("update-user-email", () => {
  beforeEach(() => {});

  const createEvent = (
    userId?: string,
    email?: string
  ): DynamoDBStreamEvent =>
    ({
      Records: [
        {
          dynamodb: {
            NewImage: {
              event: {
                M: {
                  event_name: { S: "AUTH_UPDATE_EMAIL" },
                  timestamp: { N: "1666169856" },
                  user: {
                    M: {
                      ...(userId ? { user_id: { S: userId } } : {}),
                      ...(email ? { email: { S: email } } : {}),
                    },
                  },
                },
              },
            },
          },
        },
      ],
    }) as unknown as DynamoDBStreamEvent;

  it("processes an email update event successfully", async () => {
    await expect(
      handler(
        createEvent("test-user-id", "new-email@example.com"),
        {} as Context
      )
    ).resolves.toBeUndefined();
  });

  it("throws an error when user_id is missing", async () => {
    await expect(
      handler(createEvent(undefined, "new-email@example.com"), {} as Context)
    ).rejects.toThrow("user_id is missing from the event");
  });

  it("throws an error when email is missing", async () => {
    await expect(
      handler(createEvent("test-user-id", undefined), {} as Context)
    ).rejects.toThrow("email is missing from the event");
  });

  it("processes multiple records in a single event", async () => {
    const multiRecordEvent = {
      Records: [
        {
          dynamodb: {
            NewImage: {
              event: {
                M: {
                  event_name: { S: "AUTH_UPDATE_EMAIL" },
                  timestamp: { N: "1666169856" },
                  user: {
                    M: {
                      user_id: { S: "user-1" },
                      email: { S: "user1@example.com" },
                    },
                  },
                },
              },
            },
          },
        },
        {
          dynamodb: {
            NewImage: {
              event: {
                M: {
                  event_name: { S: "AUTH_UPDATE_EMAIL" },
                  timestamp: { N: "1666169900" },
                  user: {
                    M: {
                      user_id: { S: "user-2" },
                      email: { S: "user2@example.com" },
                    },
                  },
                },
              },
            },
          },
        },
      ],
    } as unknown as DynamoDBStreamEvent;

    await expect(
      handler(multiRecordEvent, {} as Context)
    ).resolves.toBeUndefined();
  });
});
