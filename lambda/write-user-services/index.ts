import { SQSEvent, SQSRecord } from "aws-lambda";

const writeEvent = async (record: SQSRecord): Promise<void> => {
  console.log(record.body);
};

export const lambdaHandler = async (event: SQSEvent): Promise<void> => {
  event.Records.map((record) => writeEvent(record));
};
