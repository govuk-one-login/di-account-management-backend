import {
  SendMessageCommand,
  SendMessageRequest,
  SQSClient,
} from "@aws-sdk/client-sqs";
import { SQSEvent, SQSRecord } from "aws-lambda";
import type {
  UserData,
  UserRecordEvent,
  Service,
  TxmaEvent,
} from "./common/model";

const validateUserService = (service: Service): void => {
  if (
    !(
      service.client_id !== undefined &&
      service.count_successful_logins &&
      service.count_successful_logins >= 0 &&
      service.last_accessed !== undefined &&
      service.last_accessed_pretty !== undefined
    )
  ) {
    throw new Error(`Could not validate Service ${JSON.stringify(service)}`);
  }
};

const validateUserServices = (services: Service[]): void => {
  const serviceClientIds: string[] = services.map((service: Service) => {
    validateUserService(service);
    return service.client_id;
  });
  if (serviceClientIds.length !== new Set(serviceClientIds).size) {
    const filteredServices = Array.from(new Set(serviceClientIds));
    const duplicateServices = filteredServices.filter((service) =>
      filteredServices.includes(service)
    );
    throw new Error(
      `Duplicate service client_ids found: ${JSON.stringify(duplicateServices)}`
    );
  }
};

const validateUser = (user: UserData): void => {
  if (user.user_id === undefined) {
    throw new Error(`Could not validate User`);
  }
};

const validateTxmaEvent = (txmaEvent: TxmaEvent): void => {
  if (
    txmaEvent.timestamp !== undefined &&
    txmaEvent.event_name !== undefined &&
    txmaEvent.client_id !== undefined &&
    txmaEvent.user !== undefined
  ) {
    validateUser(txmaEvent.user);
  } else {
    throw new Error(`Could not validate txmaEvent`);
  }
};

export const prettifyDate = (dateEpoch: number): string => {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(
    new Date(dateEpoch)
  );
};

export const validateAndParseSQSRecord = (
  record: SQSRecord
): UserRecordEvent => {
  const parsedRecord = JSON.parse(record.body);
  const { TxmaEvent, ServiceList } = parsedRecord;
  validateTxmaEvent(TxmaEvent);
  validateUserServices(ServiceList);
  return parsedRecord;
};

export const newServicePresenter = (TxmaEvent: TxmaEvent): Service =>
  <Service>{
    client_id: TxmaEvent.client_id,
    count_successful_logins: 1,
    last_accessed: TxmaEvent.timestamp,
    last_accessed_pretty: prettifyDate(TxmaEvent.timestamp),
  };

export const existingServicePresenter = (
  service: Service,
  lastAccessed: number
): Service => ({
  client_id: service.client_id,
  count_successful_logins: service.count_successful_logins + 1,
  last_accessed: lastAccessed,
  last_accessed_pretty: prettifyDate(lastAccessed),
});

export const conditionallyUpsertServiceList = (
  matchingService: Service | undefined,
  TxmaEvent: TxmaEvent
): Service => ({
  ...(!matchingService
    ? newServicePresenter(TxmaEvent)
    : existingServicePresenter(matchingService, TxmaEvent.timestamp)),
});

export const formatRecord = (record: UserRecordEvent) => {
  const { TxmaEvent, ServiceList } = record;
  const matchingRecord = ServiceList.find(
    (service) => TxmaEvent.client_id === service.client_id
  );
  const nonMatchingRecords = ServiceList.filter(
    (service) => TxmaEvent.client_id !== service.client_id
  );

  return {
    user_id: TxmaEvent.user.user_id,
    services: [
      ...[conditionallyUpsertServiceList(matchingRecord, TxmaEvent)],
      ...nonMatchingRecords,
    ],
  };
};

export const sendSqsMessage = async (
  messageBody: string,
  queueUrl: string | undefined
): Promise<string | undefined> => {
  const { AWS_REGION } = process.env;
  const client = new SQSClient({ region: AWS_REGION });
  const message: SendMessageRequest = {
    QueueUrl: queueUrl,
    MessageBody: messageBody,
  };
  const result = await client.send(new SendMessageCommand(message));
  return result.MessageId;
};

export const handler = async (event: SQSEvent): Promise<void> => {
  const { OUTPUT_QUEUE_URL, DLQ_URL } = process.env;
  const { Records } = event;

  await Promise.all(
    Records.map(async (record) => {
      try {
        console.log(`started processing message with ID: ${record.messageId}`);
        const formattedRecord = formatRecord(validateAndParseSQSRecord(record));
        const messageId = await sendSqsMessage(
          JSON.stringify(formattedRecord),
          OUTPUT_QUEUE_URL
        );
        console.log(`[Message sent to QUEUE] with message id = ${messageId}`);
        console.log(`finished processing message with ID: ${record.messageId}`);
      } catch (err) {
        const messageId = await sendSqsMessage(record.body, DLQ_URL);
        console.error(
          `[Message sent to DLQ] with message id = ${messageId}`,
          err
        );
      }
    })
  );
};
