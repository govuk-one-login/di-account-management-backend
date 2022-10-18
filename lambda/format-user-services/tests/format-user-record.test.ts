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
  makeTxmaEventBody,
  makeServiceRecord,
  makeSQSInputFixture,
} from "./testHelpers";
import { UserServices, Service } from "../models";

const sqsMock = mockClient(SQSClient);

describe("newServicePresenter", () => {
  const TXMA_EVENT_BODY = makeTxmaEventBody("clientID1234", "userID1234");

  test("presents txmaEventBody data as a Service", () => {
    expect(newServicePresenter(TXMA_EVENT_BODY)).toEqual({
      client_id: "clientID1234",
      count_successful_logins: 1,
      last_accessed: "2022-01-01T12:00:00.000Z",
    });
  });
});

describe("existingServicePresenter", () => {
  const existingServiceRecord = makeServiceRecord(
    "clientID1234",
    4,
    "2022-01-01T12:00:00.000Z"
  );
  const lastAccessed = "2022-02-01T12:00:00.000Z";

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
      TxmaEventBody: makeTxmaEventBody("clientID1234", "userID1234"),
      ServiceList: [makeServiceRecord("clientID1234", 1)],
    };
    const validSQSFixture: SQSRecord = makeSQSInputFixture([userRecord])[0];

    expect(validateAndParseSQSRecord(validSQSFixture)).toEqual(userRecord);
  });

  test("throws if txmaEvent is invalid", () => {
    const invalidUserRecord = JSON.parse(
      JSON.stringify({
        TxmaEventBody: {},
        ServiceList: [makeServiceRecord("clientID1234", 1)],
      })
    );
    const invalidSQSFixture: SQSRecord = makeSQSInputFixture([
      invalidUserRecord,
    ])[0];

    expect(() => validateAndParseSQSRecord(invalidSQSFixture)).toThrowError(
      `Could not validate txmaEvent ${invalidUserRecord.TxmaEventBody}`
    );
  });

  test("throws if txmaEvent's user is invalid", () => {
    const invalidTxmaEvent = {
      ...makeTxmaEventBody("clientID1234", "userID1234"),
      user: {},
    };
    const invalidUserRecord = JSON.parse(
      JSON.stringify({
        TxmaEventBody: invalidTxmaEvent,
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
      TxmaEventBody: makeTxmaEventBody("clientID1234", "userID1234"),
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
        TxmaEventBody: makeTxmaEventBody("clientID1234", "userID1234"),
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
  const TxmaEventBody = makeTxmaEventBody("clientID1234", "userID1234");

  test("it updates existing records when there are matches", () => {
    expect(
      conditionallyUpsertServiceList(matchedService, TxmaEventBody)
    ).toEqual(
      existingServicePresenter(matchedService, TxmaEventBody.timestamp)
    );
  });

  it("it creates a new record from TxMA body when there are not matches", () => {
    expect(conditionallyUpsertServiceList(undefined, TxmaEventBody)).toEqual(
      newServicePresenter(TxmaEventBody)
    );
  });
});

describe("formatRecord", () => {
  test("it creates an initial service when there are none for that user", () => {
    const TxmaEventBody = makeTxmaEventBody("clientID1234", "userID1234");

    expect(formatRecord({ TxmaEventBody, ServiceList: [] })).toEqual({
      user_id: "userID1234",
      services: [makeServiceRecord("clientID1234", 1, TxmaEventBody.timestamp)],
    });
  });

  test("it incriments the count_successful_logins for an existing service", () => {
    const TxmaEventBody = makeTxmaEventBody("clientID1234", "userID1234");
    const ServiceList = [
      makeServiceRecord("clientID1234", 10, TxmaEventBody.timestamp),
    ];

    expect(formatRecord({ TxmaEventBody, ServiceList })).toEqual({
      user_id: "userID1234",
      services: [
        makeServiceRecord("clientID1234", 11, TxmaEventBody.timestamp),
      ],
    });
  });

  test("it adds a new service alongside existing services", () => {
    const TxmaEventBody = makeTxmaEventBody("clientID1234", "userID1234");
    const ServiceList = [
      makeServiceRecord("clientID5678", 10, TxmaEventBody.timestamp),
    ];

    expect(formatRecord({ TxmaEventBody, ServiceList })).toEqual({
      user_id: "userID1234",
      services: [
        makeServiceRecord("clientID1234", 1, TxmaEventBody.timestamp),
        makeServiceRecord("clientID5678", 10, TxmaEventBody.timestamp),
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

  const userRecordEvents: UserServices = {
    user_id: "user1234",
    services: [makeServiceRecord("client1234", 1)],
  };
  test("Send the SQS event on the queue", async () => {
    const messageId = await sendSqsMessage(userRecordEvents, queueURL);
    expect(messageId).toEqual(messageID);
    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl: queueURL,
      MessageBody: JSON.stringify(userRecordEvents),
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
    process.env.QUEUE_URL = queueURL;
    sqsMock.on(SendMessageCommand).resolves({ MessageId: messageID });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("it writes a formatted SQS event when user services are empty", async () => {
    const emptyServiceList = [] as Service[];
    const inputSQSEvent = makeSQSInputFixture([
      {
        TxmaEventBody: makeTxmaEventBody(serviceClientID, userId),
        ServiceList: emptyServiceList,
      },
    ]);
    const outputSQSEventMessageBodies: UserServices = {
      user_id: userId,
      services: [
        makeServiceRecord(serviceClientID, 1, "2022-01-01T12:00:00.000Z"),
      ],
    };
    await handler({ Records: inputSQSEvent });
    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl: queueURL,
      MessageBody: JSON.stringify(outputSQSEventMessageBodies),
    });
  });

  test("it writes a formatted SQS event when TxMA event matched a stored user service", async () => {
    const serviceListWithExistingService = [
      makeServiceRecord(serviceClientID, 10, "2022-01-01T12:00:00.000Z"),
    ] as Service[];
    const inputSQSEvent = makeSQSInputFixture([
      {
        TxmaEventBody: makeTxmaEventBody(serviceClientID, userId),
        ServiceList: serviceListWithExistingService,
      },
    ]);
    const outputSQSEventMessageBodies: UserServices = {
      user_id: userId,
      services: [
        makeServiceRecord(serviceClientID, 11, "2022-01-01T12:00:00.000Z"),
      ],
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
      "2022-01-01T12:00:00.000Z"
    );

    const inputSQSEvent = makeSQSInputFixture([
      {
        TxmaEventBody: makeTxmaEventBody(serviceClientID, userId),
        ServiceList: [anotherService],
      },
    ]);
    const outputSQSEventMessageBodies: UserServices = {
      user_id: userId,
      services: [
        makeServiceRecord(serviceClientID, 1, "2022-01-01T12:00:00.000Z"),
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
