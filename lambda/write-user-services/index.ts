import { SQSEvent, SQSRecord } from "aws-lambda";

import { UserServices } from "./models";

export const writeEvent = (userServices: UserServices): void => {
  console.log(userServices);
};

export const lambdaHandler = async (event: SQSEvent): Promise<void> => {
  for (let i = 0; i < event.Records.length; i++) {
    const userServices: UserServices = JSON.parse(event.Records[i].body);
    writeEvent(userServices);
  }
};
