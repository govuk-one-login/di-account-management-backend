import { SNSEvent } from "aws-lambda";
import { sendSqsMessage } from "./common/sqs";
import { SuspiciousActivityEvent, UserData } from "./common/model";
import assert from "node:assert/strict";
import { NotifyClient } from "notifications-node-client";
import "axios-debug-log";
import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import clientRegistry from "./config/clientRegistry.json";

export const formatActivityObjectForNotify = (
  activity: SuspiciousActivityEvent
): {
  email: string;
  clientName: string;
} => {
  const { ENVIRONMENT_NAME } = process.env;
  assert(ENVIRONMENT_NAME, "ENVIRONMENT_NAME env variable not set");
  assert(
    activity.user.email,
    "Email address not present in Suspicious Activity Event"
  );

  assert(
    clientRegistry[ENVIRONMENT_NAME as keyof typeof clientRegistry],
    `${ENVIRONMENT_NAME} does not exist in config/clientRegistry.json`
  );

  const registry =
    clientRegistry[ENVIRONMENT_NAME as keyof typeof clientRegistry];

  assert(
    registry[activity.client_id as keyof typeof registry],
    `${activity.client_id} does not exist in config/clientRegistry.json[${ENVIRONMENT_NAME}]`
  );

  return {
    email: activity.user.email,
    clientName: registry[activity.client_id as keyof typeof registry],
  };
};

export const sendConfMail = async (
  apiKey: string,
  templateId: string,
  activity: SuspiciousActivityEvent
) => {
  console.log("sending email");
  const client = new NotifyClient(apiKey);
  console.log("created client");
  const { email, clientName } = formatActivityObjectForNotify(activity);
  console.log("email", email);
  console.log("clientName", clientName);
  try {
    return client.sendEmail(templateId, email, {
      personalisation: {
        clientName,
      },
      reference: "abc",
    });
  } catch (e) {
    console.log(e);
  }
};

export const handler = async (event: SNSEvent): Promise<void> => {
  const { DLQ_URL, NOTIFY_API_KEY, TEMPLATE_ID } = process.env;

  await Promise.all(
    event.Records.map(async (record) => {
      try {
        assert(DLQ_URL, "DLQ_URL env variable not provided");
        assert(NOTIFY_API_KEY, "NOTIFY_API_KEY env variable not provided");
        assert(TEMPLATE_ID, "TEMPLATE_ID env variable not provided");

        const notifyApiKey = await getSecret(NOTIFY_API_KEY, {
          maxAge: 900,
        });

        assert(notifyApiKey, `${NOTIFY_API_KEY} secret not retrieved`);

        const receivedEvent: SuspiciousActivityEvent = JSON.parse(
          record.Sns.Message
        );

        await sendConfMail(notifyApiKey as string, TEMPLATE_ID, receivedEvent);
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
