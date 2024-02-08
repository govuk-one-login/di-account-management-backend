import { SNSEvent } from "aws-lambda";
import { sendSqsMessage } from "./common/sqs";
import { SuspiciousActivityEvent } from "./common/model";
import assert from "node:assert/strict";
import { NotifyClient } from "notifications-node-client";

export const validateSuspiciousActivity = (
  suspiciousActivityEvent: SuspiciousActivityEvent
): void => {
  assert(suspiciousActivityEvent.user?.email);
};

export const sendConfMail = async (email: string) => {
  console.log("sending email");
  const client = new NotifyClient(
    "dev-4237628b-1a8d-457a-89c4-8b136c18b7d7-f95b42a3-614a-40d2-b878-17444cf88cd3"
  );
  return client.sendEmail("4e07abfb-18cf-49d9-a697-c1e53dc2da6f", email, {
    personalisation: {
      name: "Tom",
    },
    reference: "abc",
  });
};

export const handler = async (event: SNSEvent): Promise<void> => {
  const { DLQ_URL } = process.env;
  console.log("in the handler");

  await Promise.all(
    event.Records.map(async (record) => {
      try {
        assert(DLQ_URL);
        //assert(NOTIFY_API_KEY);

        const receivedEvent: SuspiciousActivityEvent = JSON.parse(
          record.Sns.Message
        );

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
