import { SNSEvent } from "aws-lambda";
import { sendSqsMessage } from "./common/sqs";

export const handler = async (event: SNSEvent): Promise<void> => {
  const { DLQ_URL } = process.env;
  await Promise.all(
    event.Records.map(async (record) => {
      try {
        const receivedEvent = JSON.parse(record.Sns.Message);
        console.log(receivedEvent);
      } catch (err) {
        const response = await sendSqsMessage(record.Sns.Message, DLQ_URL);
        console.error(
          `[Message sent to DLQ] with message id = ${response.MessageId}`,
          err as Error
        );
      }
    })
  );
};
