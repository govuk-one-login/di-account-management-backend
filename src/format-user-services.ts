import { Context, SQSEvent, SQSRecord } from "aws-lambda";
import {
  type UserData,
  type UserRecordEvent,
  type Service,
  type TxmaEvent,
  DroppedEventError,
} from "./common/model";
import { sendSqsMessage } from "./common/sqs";
import { getEnvironmentVariable } from "./common/utils";
import { filterClients, getClientIDs } from "di-account-management-rp-registry";
import { Logger } from "@aws-lambda-powertools/logger";

const logger = new Logger();

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
  const txmaClientId = txmaEvent.client_id;
  const ENVIRONMENT = getEnvironmentVariable("ENVIRONMENT");

  if (
    filterClients(ENVIRONMENT, {
      showInAccounts: false,
      showInServices: false,
      showInDeleteAccount: false,
    }).some((client) => client.clientId === txmaClientId)
  ) {
    throw new DroppedEventError(
      `Event dropped as we are not displaying the RP in the Your Services Page.`
    );
  }

  if (txmaClientId && !getClientIDs(ENVIRONMENT).includes(txmaClientId)) {
    logger.warn(`The client: "${txmaClientId}" is not in the RP registry.`);
  }

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
  const date =
    dateEpoch <= Date.now() / 1000
      ? new Date(dateEpoch * 1000)
      : new Date(dateEpoch);
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(date);
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
  ({
    client_id: TxmaEvent.client_id,
    count_successful_logins: 1,
    last_accessed: TxmaEvent.timestamp,
    last_accessed_pretty: prettifyDate(TxmaEvent.timestamp),
  }) as Service;

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

export const handler = async (
  event: SQSEvent,
  context: Context
): Promise<void> => {
  logger.addContext(context);
  const { Records } = event;
  const OUTPUT_QUEUE_URL = getEnvironmentVariable("OUTPUT_QUEUE_URL");
  await Promise.all(
    Records.map(async (record) => {
      try {
        const formattedRecord = formatRecord(validateAndParseSQSRecord(record));
        await sendSqsMessage(JSON.stringify(formattedRecord), OUTPUT_QUEUE_URL);
      } catch (error) {
        if (error instanceof DroppedEventError) {
          logger.info(error.message);
        } else {
          throw new Error(
            `Unable to format user services for message with ID: ${record.messageId}, ${
              (error as Error).message
            }`
          );
        }
      }
    })
  );
};
