import { SQSEvent, SQSRecord } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { mockClient } from "aws-sdk-client-mock";
import {
  UserRecordEvent,
  TxmaEventBody,
  UserServices,
  Service,
} from "../models";
import {
  addNewService,
  createUserService,
  handler,
  matchService,
  sendSqsMessage,
  updateServiceDetails,
  validateSQSRecord,
} from "../format-user-record";

const TXMA_EVENT_BODY: TxmaEventBody = {
  event_name: "event_1",
  timestamp: new Date(),
  client_id: "client_id_3",
  component_id: "component_id",
  user: {
    user_id: "123456",
  },
};

const TXMA_EVENT_BODY_OTHER: TxmaEventBody = {
  event_name: "event_1",
  timestamp: new Date(),
  client_id: "client_id_1",
  component_id: "component_id",
  user: {
    user_id: "123456",
  },
};

const service1: Service = {
  client_id: "client_id_1",
  count_successful_logins: 1,
  last_accessed: new Date(),
};

const service2: Service = {
  client_id: "client_id_2",
  count_successful_logins: 3,
  last_accessed: new Date(),
};

const userService: UserServices = {
  user_id: "123456",
  services: [service1, service2],
};

const TEST_USER_RECORD: UserRecordEvent = {
  TxmaEventBody: TXMA_EVENT_BODY,
  ServiceList: [service1, service2],
};

const TEST_USER_RECORD_OTHER: UserRecordEvent = {
  TxmaEventBody: TXMA_EVENT_BODY_OTHER,
  ServiceList: [service1, service2],
};

const TEST_SQS_RECORD: SQSRecord = {
  messageId: "19dd0b57-b21e-4ac1-bd88-01bbb068cb78",
  receiptHandle: "MessageReceiptHandle",
  body: JSON.stringify(TEST_USER_RECORD),
  attributes: {
    ApproximateReceiveCount: "1",
    SentTimestamp: "1523232000000",
    SenderId: "123456789012",
    ApproximateFirstReceiveTimestamp: "1523232000001",
  },
  messageAttributes: {},
  md5OfBody: "7b270e59b47ff90a553787216d55d91d",
  eventSource: "aws:sqs",
  eventSourceARN: "arn:aws:sqs:us-east-1:123456789012:MyQueue",
  awsRegion: "us-east-1",
};

const TEST_SQS_EVENT: SQSEvent = {
  Records: [TEST_SQS_RECORD],
};

const MOCK_MESSAGE_ID = "MyMessageId";

const MOCK_QUEUE_URL = "http://my_queue_url";

const sqsMock = mockClient(SQSClient);

describe("validateSQSRecord", () => {
  test("validate SQS record to true", async () => {
    expect(validateSQSRecord(TEST_SQS_RECORD)).toBeTruthy();
  });
});

describe("createUserService", () => {
  test("creates a new user service", async () => {
    const newuserService: UserServices = await createUserService(
      TEST_USER_RECORD
    );
    expect(newuserService.user_id).toEqual(
      TEST_USER_RECORD.TxmaEventBody.user.user_id
    );
    expect(newuserService.services).toEqual(TEST_USER_RECORD.ServiceList);
  });
});

describe("addNewService", () => {
  test("adds a new service to the service list", async () => {
    await addNewService(TEST_USER_RECORD);
    expect(TEST_USER_RECORD.ServiceList.length).toEqual(3);
  });
});

describe("updateServiceDetails", () => {
  test("Update Service details", async () => {
    const count: number = service1.count_successful_logins.valueOf();
    await updateServiceDetails(service1, TEST_USER_RECORD);
    expect(service1.count_successful_logins).toEqual(count + 1);
    expect(service1.last_accessed).toEqual(
      TEST_USER_RECORD.TxmaEventBody.timestamp
    );
  });
});

describe("matchService", () => {
  test("Match false for the client Id from Service list to the one on TXMA event", async () => {
    const matched = await matchService(service1, TEST_USER_RECORD);
    expect(matched).toBeFalsy();
  });
  test("Match true forthe client Id from Service list to the one on TXMA event", async () => {
    const matched = await matchService(service1, TEST_USER_RECORD_OTHER);
    expect(matched).toBeTruthy();
  });
});

describe("sendSqsMessage", () => {
  beforeEach(() => {
    sqsMock.reset();
  });
  afterEach(() => {
    jest.clearAllMocks();
  });
  test("Send the SQS event on the queue", async () => {
    sqsMock.on(SendMessageCommand).resolves({ MessageId: MOCK_MESSAGE_ID });
    const messageId = await sendSqsMessage(userService, MOCK_QUEUE_URL);
    expect(messageId).toEqual(MOCK_MESSAGE_ID);
    expect(
      sqsMock.commandCalls(SendMessageCommand, {
        QueueUrl: MOCK_QUEUE_URL,
        MessageBody: JSON.stringify(userService),
      })
    );
  });
});

describe("handler", () => {
  beforeEach(() => {
    sqsMock.reset();
  });
  afterEach(() => {
    jest.clearAllMocks();
  });
  test("format method and send on SQS queue", async () => {
    sqsMock.on(SendMessageCommand).resolves({ MessageId: MOCK_MESSAGE_ID });
    await handler(TEST_SQS_EVENT);
    expect(
      sqsMock.commandCalls(SendMessageCommand, {
        QueueUrl: MOCK_QUEUE_URL,
        MessageBody: JSON.stringify(userService),
      })
    );
  });
});
