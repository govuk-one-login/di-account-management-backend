import {
  SendMessageCommand,
  SendMessageRequest,
  SQSClient,
} from "@aws-sdk/client-sqs";
import { SQSEvent, SQSRecord } from "aws-lambda";
import { UserRecordEvent, Service, UserServices } from "./models";

const QUEUE_URL = "";
const { AWS_REGION } = process.env;

export const validateSQSRecord = async (
  record: SQSRecord
): Promise<boolean> => {
  console.log(`Validating the SQS record body${record.body}`);
  return true;
};
export const matchService = async (
  service: Service,
  userRecordEvent: UserRecordEvent
): Promise<boolean> => {
  return service.client_id === userRecordEvent.TxmaEventBody.client_id;
};

/* eslint-disable no-param-reassign */
export const updateServiceDetails = async (
  service: Service,
  userRecordEvent: UserRecordEvent
) => {
  service.count_successful_logins =
    service.count_successful_logins.valueOf() + 1;
  service.last_accessed = userRecordEvent.TxmaEventBody.timestamp;
};

export const addNewService = async (userRecordEvent: UserRecordEvent) => {
  const newService: Service = {
    client_id: userRecordEvent.TxmaEventBody.client_id,
    count_successful_logins: 1,
    last_accessed: userRecordEvent.TxmaEventBody.timestamp,
  };
  userRecordEvent.ServiceList.push(newService);
};

export const createUserService = async (
  userRecordEvent: UserRecordEvent
): Promise<UserServices> => {
  const userService: UserServices = {
    user_id: userRecordEvent.TxmaEventBody.user.user_id,
    services: userRecordEvent.ServiceList,
  };

  return userService;
};

export const sendSqsMessage = async (
  messageBody: object,
  queueUrl: string
): Promise<string | undefined> => {
  const client = new SQSClient({ region: AWS_REGION });
  const message: SendMessageRequest = {
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(messageBody),
  };
  const result = await client.send(new SendMessageCommand(message));
  return result.MessageId;
};
/* eslint no-await-in-loop: "off" */
export const handler = async (event: SQSEvent): Promise<void> => {
  // eslint-disable-next-line no-restricted-syntax
  for (const record of event.Records) {
    const validationResponse = await validateSQSRecord(record as SQSRecord);
    if (!validationResponse) {
      console.log("[ERROR] Validation error ");
    } else {
      const userRecordEvent: UserRecordEvent = JSON.parse(record.body);
      // eslint-disable-next-line no-restricted-syntax
      for (const service of userRecordEvent.ServiceList) {
        if (await matchService(service, userRecordEvent)) {
          updateServiceDetails(service, userRecordEvent);
        } else {
          addNewService(userRecordEvent);
          break;
        }
      }
      const messageId = await sendSqsMessage(
        createUserService(userRecordEvent),
        QUEUE_URL
      );
      console.log(`[Message sent to QUEUE] with message id = ${messageId}`);
    }
  }
};
