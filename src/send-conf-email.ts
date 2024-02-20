import { SNSEvent } from "aws-lambda";
import { sendSqsMessage } from "./common/sqs";
import { SuspiciousActivityEvent } from "./common/model";
import assert from "node:assert/strict";
import { NotifyClient } from "notifications-node-client";
import "axios-debug-log";
import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import clientRegistry from "./config/clientRegistry.json";

type Client = {
  header: string;
  description: string;
  link_text: string;
  link_href: string;
};

export const formatActivityObjectForEmail = (
  activity: SuspiciousActivityEvent
): {
  email: string;
  clientName: string;
} => {
  const envName = process.env.ENVIRONMENT_NAME as keyof typeof clientRegistry;
  assert(envName, "ENVIRONMENT_NAME env variable not set");

  assert(
    activity.user.email,
    "Email address not present in Suspicious Activity Event"
  );

  assert(
    clientRegistry[envName],
    `${envName} does not exist in config/clientRegistry.json`
  );

  const registry = clientRegistry[envName];
  const clientId = activity.client_id as keyof typeof registry;

  assert(
    registry[clientId],
    `${activity.client_id} does not exist in config/clientRegistry.json[${envName}]`
  );

  const client: Client = registry[clientId];

  return {
    email: activity.user.email,
    clientName: client.header,
  };
};

export const sendConfMail = async (
  apiKey: string,
  templateId: string,
  activity: SuspiciousActivityEvent
) => {
  const notifyClient = new NotifyClient(apiKey);
  const { email, clientName } = formatActivityObjectForEmail(activity);
  return notifyClient.sendEmail(templateId, email, {
    personalisation: {
      clientName,
    },
    reference: activity.event_id,
  });
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
