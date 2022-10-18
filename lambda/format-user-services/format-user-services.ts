import {
  SendMessageCommand,
  SendMessageRequest,
  SQSClient,
} from "@aws-sdk/client-sqs";
import { SQSEvent, SQSRecord } from "aws-lambda";
import type {
  UserData,
  UserRecordEvent,
  UserServices,
  Service,
  TxmaEventBody,
} from "./models";

const { AWS_REGION } = process.env;

const validateUserService = (service: Service): void => {
  if (
    !(
      service.client_id !== undefined &&
      service.count_successful_logins &&
      service.count_successful_logins >= 0 &&
      service.last_accessed !== undefined
    )
  ) {
    throw new Error(`Could not validate Service ${service}`);
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
    throw new Error(`Duplicate service client_ids found: ${duplicateServices}`);
  }
};

const validateUser = (user: UserData): void => {
  if (user.user_id === undefined) {
    throw new Error(`Could not find User ${user}`);
  }
};

const validateTxmaEventBody = (txmaEvent: TxmaEventBody): void => {
  if (
    txmaEvent.client_id !== undefined &&
    txmaEvent.timestamp !== undefined &&
    txmaEvent.event_name !== undefined &&
    txmaEvent.component_id !== undefined &&
    txmaEvent.user !== undefined
  ) {
    validateUser(txmaEvent.user);
  } else {
    throw new Error(`Could not validate txmaEvent ${txmaEvent}`);
  }
};

export const validateAndParseSQSRecord = (
  record: SQSRecord
): UserRecordEvent => {
  const parsedRecord = JSON.parse(record.body);
  const { TxmaEventBody, ServiceList } = parsedRecord;
  validateTxmaEventBody(TxmaEventBody);
  validateUserServices(ServiceList);
  return parsedRecord;
};

export const newServicePresenter = (txmaEventBody: TxmaEventBody): Service => ({
  client_id: txmaEventBody.client_id,
  count_successful_logins: 1,
  last_accessed: txmaEventBody.timestamp,
});

export const existingServicePresenter = (
  service: Service,
  lastAccessed: string
): Service => ({
  client_id: service.client_id,
  count_successful_logins: service.count_successful_logins + 1,
  last_accessed: lastAccessed,
});

export const conditionallyUpsertServiceList = (
  matchingService: Service | undefined,
  TxmaEventBody: TxmaEventBody
): Service => ({
  ...(!matchingService
    ? newServicePresenter(TxmaEventBody)
    : existingServicePresenter(matchingService, TxmaEventBody.timestamp)),
});

export const formatRecord = (record: UserRecordEvent) => {
  const { TxmaEventBody, ServiceList } = record;
  const matchingRecord = ServiceList.find(
    (service) => TxmaEventBody.client_id === service.client_id
  );
  const nonMatchingRecords = ServiceList.filter(
    (service) => TxmaEventBody.client_id !== service.client_id
  );

  return {
    user_id: TxmaEventBody.user.user_id,
    services: [
      ...[conditionallyUpsertServiceList(matchingRecord, TxmaEventBody)],
      ...nonMatchingRecords,
    ],
  };
};

export const sendSqsMessage = async (
  messageBody: UserServices,
  queueUrl: string | undefined
): Promise<string | undefined> => {
  const client = new SQSClient({ region: AWS_REGION });
  const message: SendMessageRequest = {
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(messageBody),
  };
  const result = await client.send(new SendMessageCommand(message));
  return result.MessageId;
};

export const handler = async (event: SQSEvent): Promise<void> => {
  const { QUEUE_URL } = process.env;
  const { Records } = event;

  Records.forEach(async (record) => {
    const formattedRecord = formatRecord(validateAndParseSQSRecord(record));
    const messageId = await sendSqsMessage(formattedRecord, QUEUE_URL);
    console.log(`[Message sent to QUEUE] with message id = ${messageId}`);
  });
};
