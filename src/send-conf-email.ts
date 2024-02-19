import { SNSEvent } from "aws-lambda";
import { sendSqsMessage } from "./common/sqs";
import { SuspiciousActivityEvent } from "./common/model";
import assert from "node:assert/strict";
import axios from "axios";
import "axios-debug-log";

export const validateSuspiciousActivity = (
  suspiciousActivityEvent: SuspiciousActivityEvent
): void => {
  assert(suspiciousActivityEvent.user?.email);
};

export const sendConfMail = async (email: string) => {
  const instance = axios.create({
    baseURL: "https://api.notifications.service.gov.uk",
  });

  return await instance.post("/test", {});
  //console.log("sending email");
  //const client = new NotifyClient(
  //  "test-4237628b-1a8d-457a-89c4-8b136c18b7d7-a998abca-4854-408d-930d-a82189fc7459"
  //);
  //console.log("created client");
  //return client.sendEmail("4e07abfb-18cf-49d9-a697-c1e53dc2da6f", email, {
  //  personalisation: {
  //    name: "Tom",
  //  },
  //  reference: "abc",
  //});
};

export const handler = async (event: SNSEvent): Promise<void> => {
  const { DLQ_URL } = process.env;
  console.log("in the handler");

  await Promise.all(
    event.Records.map(async (record) => {
      try {
        console.log("in the first record");
        assert(DLQ_URL);
        // assert(NOTIFY_API_KEY);

        const receivedEvent: SuspiciousActivityEvent = JSON.parse(
          record.Sns.Message
        );

        console.log("event", receivedEvent);

        validateSuspiciousActivity(receivedEvent);
        console.log("validated");

        await sendConfMail("saral.kaushik@digital.cabinet-office.gov.uk");
        console.log("email sent");
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
