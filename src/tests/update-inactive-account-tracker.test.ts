import { vi, describe, test, expect, afterEach } from "vitest";
import { Context, DynamoDBStreamEvent } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { handler } from "../update-inactive-account-tracker.js";
import { generateDynamoSteamRecord } from "./testFixtures.js";

describe("UpdateInactiveAccountTracker handler", () => {
  const loggerInfoMock = vi
    .spyOn(Logger.prototype, "info")
    .mockImplementation(() => undefined);

  afterEach(() => {
    loggerInfoMock.mockClear();
  });

  test("logs invocation message", async () => {
    const event: DynamoDBStreamEvent = { Records: [generateDynamoSteamRecord('test-client')] };
    await handler(event, {} as Context);
    expect(loggerInfoMock).toHaveBeenCalledWith(
      "UpdateInactiveAccountTracker invoked"
    );
  });
});
