import { SQSEvent, SQSRecord } from "aws-lambda";

import { UserServices } from "./models";

export const writeEvent = async (record: SQSRecord): Promise<void> => {
  const userServices: UserServices = JSON.parse(record.body);
  console.log(userServices);
};

export const lambdaHandler = async (event: SQSEvent): Promise<void> => {
  for (let i = 0; i < event.Records.length; i++) {
    const eventBody: QueryEventBody = JSON.parse(event.Records[0].body);
    return formatEvent(eventBody);
  }
};

interface TxmaEventBody {
  event_name: AllowedEventType;
  timestamp: Date;
  client_id: ClientID;
  component_id: String; // oidc-base-url
  user: UserData;
}

interface QueryEventBody {
  TxmaEventBody: TxmaEventBody;
  ExistingDBRecords: ServiceRecords;
}

interface ServiceRecords {
  user_id: UrnFdnSub;
  services: [ServiceRecord];
}

interface ServiceRecord {
  client_id: ClientID;
  count_successful_logins: Number;
  last_accessed: Date;
}

export const formatEvent = (body: QueryEventBody): void => {
  const txmaEvent = body.TxmaEventBody;
  for (let i = 0; i < body.ExistingDBRecords.services.length; i++) {
    var service = body.ExistingDBRecords.services[i];
    if (service.client_id == txmaEvent.client_id) {
    }
  }
};
