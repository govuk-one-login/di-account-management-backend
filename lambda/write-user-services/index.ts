import { SQSEvent, SQSRecord } from "aws-lambda";

import { UserServices } from "./models";

export const writeEvent = async (record: SQSRecord): Promise<void> => {
  const userServices: UserServices = JSON.parse(record.body);
  console.log(userServices);
};

export const lambdaHandler = async (event: SQSEvent): Promise<void> => {
  event.Records.map((record) => writeEvent(record));
};
