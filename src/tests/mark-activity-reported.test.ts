import "aws-sdk-client-mock-jest";
import {
  decryptEventType,
  handler,
  markEventAsReported,
} from "../mark-activity-reported";
import { mockClient } from "aws-sdk-client-mock";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  queueUrl,
  eventId,
  tableName,
  userId,
  testSuspiciousActivity,
  TEST_ENCRYPTED_ACTIVITY_LOG_ENTRY,
  timestamp,
} from "./testFixtures";
import { COMPONENT_ID, EventNamesEnum } from "../common/constants";
import { decryptData } from "../decrypt-data";

jest.mock("../decrypt-data.ts");

const dynamoMock = mockClient(DynamoDBDocumentClient);

describe("markEventAsReported", () => {
  beforeEach(() => {
    dynamoMock.reset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("updates the correct event as reported", async () => {
    await markEventAsReported(tableName, userId, eventId, timestamp);
    expect(dynamoMock.commandCalls(UpdateCommand).length).toEqual(1);
    expect(dynamoMock).toHaveReceivedCommandWith(UpdateCommand, {
      TableName: tableName,
      Key: {
        user_id: userId,
        event_id: eventId,
      },
      UpdateExpression:
        "set reported_suspicious = :reported_suspicious, reported_suspicious_time = :reported_suspicious_time",
      ExpressionAttributeValues: {
        ":reported_suspicious": true,
        ":reported_suspicious_time": timestamp,
      },
    });
  });
});

describe("handler", () => {
  const OLD_ENV = process.env;
  let consoleErrorMock: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();

    process.env = { ...OLD_ENV };
    process.env.ACTIVITY_LOG_TABLE_NAME = tableName;
    process.env.DLQ_URL = queueUrl;
    process.env.GENERATOR_KEY_ARN = "generator-key";
    process.env.WRAPPING_KEY_ARN = "wrapping-key";
    process.env.BACKUP_WRAPPING_KEY_ARN = "backup-erapping-key";

    dynamoMock.reset();
    dynamoMock.on(QueryCommand).resolves({
      Items: [TEST_ENCRYPTED_ACTIVITY_LOG_ENTRY],
    });
    consoleErrorMock = jest.spyOn(global.console, "error").mockImplementation();
    (decryptData as jest.Mock).mockImplementation(() => {
      return "TXMA_EVENT";
    });
  });

  afterEach(() => {
    consoleErrorMock.mockRestore();
    jest.clearAllMocks();
    process.env = OLD_ENV;
  });

  test("the handler makes the correct queries", async () => {
    await handler(testSuspiciousActivity);
    expect(dynamoMock.commandCalls(UpdateCommand).length).toEqual(1);
    expect(dynamoMock.commandCalls(QueryCommand).length).toEqual(1);

    expect(dynamoMock).toHaveReceivedCommandWith(UpdateCommand, {
      TableName: tableName,
      Key: {
        user_id: userId,
        event_id: eventId,
      },
      UpdateExpression:
        "set reported_suspicious = :reported_suspicious, reported_suspicious_time = :reported_suspicious_time",
      ExpressionAttributeValues: {
        ":reported_suspicious": true,
        ":reported_suspicious_time": timestamp,
      },
    });
    expect(dynamoMock).toHaveReceivedCommandWith(QueryCommand, {
      TableName: tableName,
      KeyConditionExpression: "user_id = :user_id and event_id = :event_id",
      ExpressionAttributeValues: {
        ":user_id": userId,
        ":event_id": eventId,
      },
    });
  });

  test("the handler creates correct output for next step function", async () => {
    const response = await handler(testSuspiciousActivity);
    expect(dynamoMock.commandCalls(UpdateCommand).length).toEqual(1);
    expect(response.event_id).not.toBeNull();
    expect(response.email_address).toEqual(testSuspiciousActivity.email);
    expect(response.suspicious_activity.reported_suspicious).toBe(true);
    expect(response.timestamp).not.toBeNull();
    expect(response.timestamp_formatted).not.toBeNull();
    expect(response.event_timestamp_ms_formatted).not.toBeNull();
    expect(response.event_timestamp_ms).not.toBeNull();
    expect(response.notify_message_id).toBeUndefined();
    expect(response.zendesk_ticket_id).toBeUndefined();
    expect(response.component_id).toEqual(COMPONENT_ID);
    expect(response.device_information).toBeUndefined();
    expect(response.event_type).toEqual(
      EventNamesEnum.HOME_REPORT_SUSPICIOUS_ACTIVITY
    );
  });

  test("the handler creates correct output for next step function includes device_info", async () => {
    const encodedDeviceInfo = "dsadddasa";
    testSuspiciousActivity.device_information = encodedDeviceInfo;
    const response = await handler(testSuspiciousActivity);
    expect(dynamoMock.commandCalls(UpdateCommand).length).toEqual(1);
    expect(response.event_id).not.toBeNull();
    expect(response.email_address).toEqual(testSuspiciousActivity.email);
    expect(response.suspicious_activity.reported_suspicious).toBe(true);
    expect(response.timestamp).not.toBeNull();
    expect(response.timestamp_formatted).not.toBeNull();
    expect(response.event_timestamp_ms_formatted).not.toBeNull();
    expect(response.event_timestamp_ms).not.toBeNull();
    expect(response.notify_message_id).toBeUndefined();
    expect(response.zendesk_ticket_id).toBeUndefined();
    expect(response.component_id).toEqual(COMPONENT_ID);
    expect(response.event_type).toEqual(
      EventNamesEnum.HOME_REPORT_SUSPICIOUS_ACTIVITY
    );
    expect(response.device_information).toEqual(encodedDeviceInfo);
    testSuspiciousActivity.device_information = undefined;
  });

  test("the handler log and throw an error", async () => {
    process.env.ACTIVITY_LOG_TABLE_NAME = undefined;
    let errorThrown = false;
    try {
      await handler(testSuspiciousActivity);
    } catch (error) {
      errorThrown = true;
    }

    expect(consoleErrorMock).toHaveBeenCalledTimes(1);
    expect(consoleErrorMock.mock.calls[0][0]).toContain(
      "Error marking event as reported"
    );
    expect(errorThrown).toBeTruthy();
  });
});

describe("decrypt event type", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  const generatorKey =
    "arn:aws:kms:eu-west-2:111122223333:key/bc436485-5092-42b8-92a3-0aa8b93536dc";
  const wrappingKey =
    "arn:aws:kms:eu-west-2:111122223333:key/49c5492b-b1bc-42a8-9a5c-b2015e810c1c";
  (decryptData as jest.Mock).mockImplementation(() => {
    return "TXMA_EVENT";
  });

  test("decrypts event type correctly", async () => {
    const result = await decryptEventType(
      userId,
      TEST_ENCRYPTED_ACTIVITY_LOG_ENTRY,
      generatorKey,
      wrappingKey
    );
    expect(decryptData as jest.Mock).toHaveBeenCalledTimes(1);
    expect(decryptData as jest.Mock).toHaveBeenCalledWith(
      TEST_ENCRYPTED_ACTIVITY_LOG_ENTRY.event_type,
      userId,
      generatorKey,
      wrappingKey
    );
    expect(result).toEqual("TXMA_EVENT");
  });
});
