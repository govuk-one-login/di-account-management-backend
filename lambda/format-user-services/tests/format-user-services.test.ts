import { SQSRecord } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import "aws-sdk-client-mock-jest";

import { mockClient } from "aws-sdk-client-mock";
import {
  newServicePresenter,
  existingServicePresenter,
  validateAndParseSQSRecord,
  sendSqsMessage,
  conditionallyUpsertServiceList,
  formatRecord,
  handler,
} from "../format-user-services";

import {
  makeTxmaEvent,
  makeServiceRecord,
  makeSQSInputFixture,
} from "./testHelpers";
import { UserServices, Service } from "../models";

const sqsMock = mockClient(SQSClient);

describe("newServicePresenter", () => {
  const TXMA_EVENT = makeTxmaEvent("clientID1234", "userID1234");

  test("presents TxmaEvent data as a Service", () => {
    expect(newServicePresenter(TXMA_EVENT)).toEqual({
      client_id: "clientID1234",
      count_successful_logins: 1,
      last_accessed: 1670850655485,
    });
  });
});

describe("existingServicePresenter", () => {
  const existingServiceRecord = makeServiceRecord(
    "clientID1234",
    4,
    1670850655485
  );
  const lastAccessed = 1670850655485;

  test("modifies existing Service record", () => {
    expect(
      existingServicePresenter(existingServiceRecord, lastAccessed)
    ).toEqual({
      client_id: existingServiceRecord.client_id,
      count_successful_logins:
        existingServiceRecord.count_successful_logins + 1,
      last_accessed: lastAccessed,
    });
  });
});

describe("validateAndParseSQSRecord", () => {
  test("returns a valid SQS fixture as a parsed UserRecord", () => {
    const userRecord = {
      TxmaEvent: makeTxmaEvent("clientID1234", "userID1234"),
      ServiceList: [makeServiceRecord("clientID1234", 1)],
    };
    const validSQSFixture: SQSRecord = makeSQSInputFixture([userRecord])[0];

    expect(validateAndParseSQSRecord(validSQSFixture)).toEqual(userRecord);
  });

  test("throws if txmaEvent is invalid", () => {
    const invalidUserRecord = JSON.parse(
      JSON.stringify({
        TxmaEvent: {},
        ServiceList: [makeServiceRecord("clientID1234", 1)],
      })
    );
    const invalidSQSFixture: SQSRecord = makeSQSInputFixture([
      invalidUserRecord,
    ])[0];

    expect(() => validateAndParseSQSRecord(invalidSQSFixture)).toThrowError(
      `Could not validate txmaEvent ${invalidUserRecord.TxmaEvent}`
    );
  });

  test("throws if txmaEvent's user is invalid", () => {
    const invalidTxmaEvent = {
      ...makeTxmaEvent("clientID1234", "userID1234"),
      user: {},
    };
    const invalidUserRecord = JSON.parse(
      JSON.stringify({
        TxmaEvent: invalidTxmaEvent,
        ServiceList: [makeServiceRecord("clientID1234", 1)],
      })
    );
    const invalidSQSFixture: SQSRecord = makeSQSInputFixture([
      invalidUserRecord,
    ])[0];

    expect(() => validateAndParseSQSRecord(invalidSQSFixture)).toThrowError(
      `Could not find User ${{}}`
    );
  });

  test("throws if a present service record is a duplicate", () => {
    const invalidUserRecord = {
      TxmaEvent: makeTxmaEvent("clientID1234", "userID1234"),
      ServiceList: [
        makeServiceRecord("clientID1234", 1),
        makeServiceRecord("clientID1234", 1),
      ],
    };
    const invalidSQSFixture: SQSRecord = makeSQSInputFixture([
      invalidUserRecord,
    ])[0];

    expect(() => validateAndParseSQSRecord(invalidSQSFixture)).toThrowError(
      `Duplicate service client_ids found: clientID1234`
    );
  });

  test("throws if a present service record is invalid", () => {
    const invalidServiceRecord = {
      ...makeServiceRecord("clientID1234", 1),
      client_id: undefined,
    };
    const invalidUserRecord = JSON.parse(
      JSON.stringify({
        TxmaEvent: makeTxmaEvent("clientID1234", "userID1234"),
        ServiceList: [invalidServiceRecord],
      })
    );
    const invalidSQSFixture: SQSRecord = makeSQSInputFixture([
      invalidUserRecord,
    ])[0];

    expect(() => validateAndParseSQSRecord(invalidSQSFixture)).toThrowError(
      `Could not validate Service ${invalidUserRecord.ServiceList[0]}`
    );
  });
});

describe("conditionallyUpsertServiceList", () => {
  const matchedService = makeServiceRecord("clientID1234", 1);
  const TxmaEvent = makeTxmaEvent("clientID1234", "userID1234");

  test("it updates existing records when there are matches", () => {
    expect(conditionallyUpsertServiceList(matchedService, TxmaEvent)).toEqual(
      existingServicePresenter(matchedService, TxmaEvent.timestamp)
    );
  });

  it("it creates a new record from TxMA body when there are not matches", () => {
    expect(conditionallyUpsertServiceList(undefined, TxmaEvent)).toEqual(
      newServicePresenter(TxmaEvent)
    );
  });
});

describe("formatRecord", () => {
  test("it creates an initial service when there are none for that user", () => {
    const TxmaEvent = makeTxmaEvent("clientID1234", "userID1234");

    expect(formatRecord({ TxmaEvent, ServiceList: [] })).toEqual({
      user_id: "userID1234",
      services: [makeServiceRecord("clientID1234", 1, TxmaEvent.timestamp)],
    });
  });

  test("it incriments the count_successful_logins for an existing service", () => {
    const TxmaEvent = makeTxmaEvent("clientID1234", "userID1234");
    const ServiceList = [
      makeServiceRecord("clientID1234", 10, TxmaEvent.timestamp),
    ];

    expect(formatRecord({ TxmaEvent, ServiceList })).toEqual({
      user_id: "userID1234",
      services: [makeServiceRecord("clientID1234", 11, TxmaEvent.timestamp)],
    });
  });

  test("it adds a new service alongside existing services", () => {
    const TxmaEvent = makeTxmaEvent("clientID1234", "userID1234");
    const ServiceList = [
      makeServiceRecord("clientID5678", 10, TxmaEvent.timestamp),
    ];

    expect(formatRecord({ TxmaEvent, ServiceList })).toEqual({
      user_id: "userID1234",
      services: [
        makeServiceRecord("clientID1234", 1, TxmaEvent.timestamp),
        makeServiceRecord("clientID5678", 10, TxmaEvent.timestamp),
      ],
    });
  });
});

describe("sendSqsMessage", () => {
  const messageID = "MyMessageId";
  const queueURL = "http://my_queue_url";

  beforeEach(() => {
    sqsMock.reset();
    sqsMock.on(SendMessageCommand).resolves({ MessageId: messageID });
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  const userRecordEvents: string = JSON.stringify({
    user_id: "user1234",
    services: [makeServiceRecord("client1234", 1)],
  });
  test("Send the SQS event on the queue", async () => {
    const messageId = await sendSqsMessage(userRecordEvents, queueURL);
    expect(messageId).toEqual(messageID);
    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl: queueURL,
      MessageBody: userRecordEvents,
    });
  });
});

describe("handler", () => {
  const messageID = "MyMessageId";
  const sqsQueueName = "ToWriteSQS";
  const queueURL = "http://my_queue_url";
  const userId = "userID1234";
  const serviceClientID = "clientID1234";

  beforeEach(() => {
    sqsMock.reset();
    process.env.OUTPUT_SQS_NAME = sqsQueueName;
    process.env.OUTPUT_QUEUE_URL = queueURL;
    sqsMock.on(SendMessageCommand).resolves({ MessageId: messageID });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("it writes a formatted SQS event when user services are empty", async () => {
    const emptyServiceList = [] as Service[];
    const inputSQSEvent = makeSQSInputFixture([
      {
        TxmaEvent: makeTxmaEvent(serviceClientID, userId),
        ServiceList: emptyServiceList,
      },
    ]);
    const outputSQSEventMessageBodies: UserServices = {
      user_id: userId,
      services: [makeServiceRecord(serviceClientID, 1, 1670850655485)],
    };
    await handler({ Records: inputSQSEvent });
    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl: queueURL,
      MessageBody: JSON.stringify(outputSQSEventMessageBodies),
    });
  });

  test("it writes a formatted SQS event when TxMA event matched a stored user service", async () => {
    const serviceListWithExistingService = [
      makeServiceRecord(serviceClientID, 10, 1670850655485),
    ] as Service[];
    const inputSQSEvent = makeSQSInputFixture([
      {
        TxmaEvent: makeTxmaEvent(serviceClientID, userId),
        ServiceList: serviceListWithExistingService,
      },
    ]);
    const outputSQSEventMessageBodies: UserServices = {
      user_id: userId,
      services: [makeServiceRecord(serviceClientID, 11, 1670850655485)],
    };
    await handler({ Records: inputSQSEvent });
    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl: queueURL,
      MessageBody: JSON.stringify(outputSQSEventMessageBodies),
    });
  });

  test("it writes a formatted SQS event when TxMA event is a new service", async () => {
    const anotherService = makeServiceRecord(
      "anotherClientId",
      10,
      1670850655485
    );

    const inputSQSEvent = makeSQSInputFixture([
      {
        TxmaEvent: makeTxmaEvent(serviceClientID, userId),
        ServiceList: [anotherService],
      },
    ]);
    const outputSQSEventMessageBodies: UserServices = {
      user_id: userId,
      services: [
        makeServiceRecord(serviceClientID, 1, 1670850655485),
        anotherService,
      ],
    };
    await handler({ Records: inputSQSEvent });
    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl: queueURL,
      MessageBody: JSON.stringify(outputSQSEventMessageBodies),
    });
  });
});

describe("handler error handling ", () => {
  const messageID = "MyMessageId";
  const sqsQueueName = "ToWriteSQS";
  const queueURL = "http://my_queue_url";
  let consoleErrorMock: jest.SpyInstance;
  beforeEach(() => {
    consoleErrorMock = jest.spyOn(global.console, "error").mockImplementation();
    sqsMock.reset();
    process.env.OUTPUT_SQS_NAME = sqsQueueName;
    process.env.OUTPUT_QUEUE_URL = queueURL;
    sqsMock.on(SendMessageCommand).resolves({ MessageId: messageID });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("write to a dead letter queue when an error is thrown", async () => {
    const emptyServiceList = [] as Service[];
    const invalidTxmaEvent = JSON.parse(
      JSON.stringify({
        services: [
          {
            client_id: "client_id",
            timestamp: new Date().toISOString,
            event_name: "event_name",
            user: {
              user_id: "user_id",
            },
          },
        ],
      })
    );
    const inputSQSEvent = makeSQSInputFixture([
      {
        TxmaEvent: invalidTxmaEvent,
        ServiceList: emptyServiceList,
      },
    ]);
    await handler({ Records: inputSQSEvent });
    expect(consoleErrorMock).toHaveBeenCalledTimes(1);
    expect(sqsMock.commandCalls(SendMessageCommand).length).toEqual(1);
  });
});
