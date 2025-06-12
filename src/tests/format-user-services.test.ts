import { Context, SQSRecord } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import "aws-sdk-client-mock-jest";

import { mockClient } from "aws-sdk-client-mock";
import {
  newServicePresenter,
  existingServicePresenter,
  validateAndParseSQSRecord,
  conditionallyUpsertServiceList,
  formatRecord,
  prettifyDate,
  handler,
} from "../format-user-services";

import { DroppedEventError, Service, UserServices } from "../common/model";
import {
  makeServiceRecord,
  makeSQSInputFixture,
  makeTxmaEvent,
} from "./testUtils";
import { sendSqsMessage } from "../common/sqs";
import { Logger } from "@aws-lambda-powertools/logger";

const sqsMock = mockClient(SQSClient);

describe("newServicePresenter", () => {
  beforeEach(() => {
    process.env.AWS_REGION = "AWS_REGION";
    process.env.ENVIRONMENT = "test";
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const TXMA_EVENT = makeTxmaEvent("clientID1234", "userID1234");

  test("presents TxmaEvent data as a Service", () => {
    expect(newServicePresenter(TXMA_EVENT)).toEqual({
      client_id: "clientID1234",
      count_successful_logins: 1,
      last_accessed: 1670850655,
      last_accessed_pretty: "12 December 2022",
    });
  });
});

describe("existingServicePresenter", () => {
  const existingServiceRecord = makeServiceRecord(
    "clientID1234",
    4,
    1670850655
  );
  const lastAccessed = 1670850655;
  const formattedDate = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
  }).format(new Date(lastAccessed * 1000));

  test("modifies existing Service record", () => {
    expect(
      existingServicePresenter(existingServiceRecord, lastAccessed)
    ).toEqual({
      client_id: existingServiceRecord.client_id,
      count_successful_logins:
        existingServiceRecord.count_successful_logins + 1,
      last_accessed: lastAccessed,
      last_accessed_pretty: formattedDate,
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

    expect(() => validateAndParseSQSRecord(invalidSQSFixture)).toThrow(
      `Could not validate txmaEvent`
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

    expect(() => validateAndParseSQSRecord(invalidSQSFixture)).toThrow(
      `Could not validate User`
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

    expect(() => validateAndParseSQSRecord(invalidSQSFixture)).toThrow(
      `Duplicate service client_ids found: ["clientID1234"]`
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

    expect(() => validateAndParseSQSRecord(invalidSQSFixture)).toThrow(
      `Could not validate Service ${JSON.stringify(
        invalidUserRecord.ServiceList[0]
      )}`
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
    process.env.AWS_REGION = "AwsRegion";
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  const userRecordEvents: string = JSON.stringify({
    user_id: "user1234",
    services: [makeServiceRecord("client1234", 1)],
  });
  test("Send the SQS event on the queue", async () => {
    const messageId = (await sendSqsMessage(userRecordEvents, queueURL))
      .MessageId;
    expect(messageId).toEqual(messageID);
    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl: queueURL,
      MessageBody: userRecordEvents,
    });
  });
});

describe("prettifyDate", () => {
  test("It takes a date Epoch as a number and returns a pretty formatted date", async () => {
    const date = new Date(2022, 0, 1);
    const epochTimestamp = date.getTime() / 1000;
    expect(prettifyDate(epochTimestamp)).toEqual("1 January 2022");
  });

  test("It takes a date Epoch later than now as a number and returns a pretty formatted date", async () => {
    const date = new Date(2024, 0, 1);
    const epochTimestamp = date.getTime();
    expect(prettifyDate(epochTimestamp)).toEqual("1 January 2024");
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
    process.env.AWS_REGION = "AwsRegion";
    process.env.ENVIRONMENT = "test";
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
      services: [makeServiceRecord(serviceClientID, 1, 1670850655)],
    };
    await handler({ Records: inputSQSEvent }, {} as Context);
    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl: queueURL,
      MessageBody: JSON.stringify(outputSQSEventMessageBodies),
    });
  });

  test("it writes a formatted SQS event when TxMA event matched a stored user service", async () => {
    const serviceListWithExistingService = [
      makeServiceRecord(serviceClientID, 10, 1670850655),
    ] as Service[];
    const inputSQSEvent = makeSQSInputFixture([
      {
        TxmaEvent: makeTxmaEvent(serviceClientID, userId),
        ServiceList: serviceListWithExistingService,
      },
    ]);
    const outputSQSEventMessageBodies: UserServices = {
      user_id: userId,
      services: [makeServiceRecord(serviceClientID, 11, 1670850655)],
    };
    await handler({ Records: inputSQSEvent }, {} as Context);
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
        makeServiceRecord(serviceClientID, 1, 1670850655),
        anotherService,
      ],
    };
    await handler({ Records: inputSQSEvent }, {} as Context);
    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl: queueURL,
      MessageBody: JSON.stringify(outputSQSEventMessageBodies),
    });
  });

  test("drops hmrc events", async () => {
    const emptyServiceList = [] as Service[];
    const hmrc_client_id = "hmrcGovernmentGateway";
    const inputSQSEvent = makeSQSInputFixture([
      {
        TxmaEvent: makeTxmaEvent(hmrc_client_id, userId),
        ServiceList: emptyServiceList,
      },
    ]);

    Logger.prototype.info = jest.fn();
    await handler({ Records: inputSQSEvent }, {} as Context);
    expect(Logger.prototype.info).toHaveBeenCalledWith(
      "Event dropped due to internal RP."
    );
  });

  test("no warning message logged as client id is expected", async () => {
    const emptyServiceList = [] as Service[];
    const hmrc_client_id = "EMGmY82k-92QSakDl_9keKDFmZY"; //home non prod ID
    const inputSQSEvent = makeSQSInputFixture([
      {
        TxmaEvent: makeTxmaEvent(hmrc_client_id, userId),
        ServiceList: emptyServiceList,
      },
    ]);

    Logger.prototype.warn = jest.fn();
    await handler({ Records: inputSQSEvent }, {} as Context);
    expect(Logger.prototype.warn).toHaveLength(0);
  });

  test("logs a warning when client id doesn't match rp registry", async () => {
    const emptyServiceList = [] as Service[];
    const hmrc_client_id = "UNKNOWN";
    const inputSQSEvent = makeSQSInputFixture([
      {
        TxmaEvent: makeTxmaEvent(hmrc_client_id, userId),
        ServiceList: emptyServiceList,
      },
    ]);

    Logger.prototype.warn = jest.fn();
    await handler({ Records: inputSQSEvent }, {} as Context);
    expect(Logger.prototype.warn).toHaveBeenCalledWith(
      'The client: "UNKNOWN" is not in the RP registry.'
    );
  });
});

describe("handler error handling ", () => {
  const messageID = "MyMessageId";
  const sqsQueueName = "ToWriteSQS";
  const queueURL = "http://my_queue_url";
  beforeEach(() => {
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

    let errorMessage;
    try {
      await handler({ Records: inputSQSEvent }, {} as Context);
    } catch (error) {
      errorMessage = (error as Error).message;
    }
    expect(errorMessage).toContain(
      "Unable to format user services for message with ID: 19dd0b57-b21e-4ac1-bd88-01bbb068cb78, Could not validate txmaEvent"
    );
  });
});

describe("DroppedEventError", () => {
  it("should create an error with the correct name", () => {
    const errorMessage = "This is a test error message";
    const error = new DroppedEventError(errorMessage);

    expect(error.name).toBe("DroppedEventError");
    expect(error.message).toBe(errorMessage);
  });
});
