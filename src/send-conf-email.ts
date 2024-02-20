import { SNSEvent } from "aws-lambda";
import { sendSqsMessage } from "./common/sqs";
import { SuspiciousActivityEvent } from "./common/model";
import assert from "node:assert/strict";
import { NotifyClient } from "notifications-node-client";
import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import clientRegistryEn from "./config/clientRegistry.en.json";
import clientRegistryCy from "./config/clientRegistry.cy.json";
import { ClientRegistry, Environment, RPClient } from "./common/model";

export const getClientInfo = (
  clientRegistry: ClientRegistry,
  environment: Environment,
  id: string
): RPClient => {
  assert(
    clientRegistry[environment],
    `${environment} does not exist in client registry`
  );

  const registry = clientRegistry[environment];

  assert(
    registry[id],
    `${id} does not exist in ${environment} client registry]`
  );

  const client: RPClient = registry[id];

  return client;
};

export const formatActivityObjectForEmail = (
  activity: SuspiciousActivityEvent
): {
  email: string;
  clientNameEn: string;
  clientNameCy: string;
} => {
  const envName = process.env.ENVIRONMENT_NAME as Environment;
  assert(envName, "ENVIRONMENT_NAME env variable not set");

  assert(
    activity.user.email,
    "Email address not present in Suspicious Activity Event"
  );

  const clientEn = getClientInfo(clientRegistryEn, envName, activity.client_id);
  const clientCy = getClientInfo(clientRegistryCy, envName, activity.client_id);

  return {
    email: activity.user.email,
    clientNameEn: clientEn.header,
    clientNameCy: clientCy.header,
  };
};

export const sendConfMail = async (
  apiKey: string,
  templateId: string,
  activity: SuspiciousActivityEvent
) => {
  const notifyClient = new NotifyClient(apiKey);
  const { email, clientNameEn, clientNameCy } =
    formatActivityObjectForEmail(activity);

  return notifyClient.sendEmail(templateId, email, {
    personalisation: {
      clientNameEn,
      clientNameCy,
    },
    reference: activity.event_id,
  });
};

export const handler = async (event: SNSEvent): Promise<void> => {
  const { DLQ_URL, NOTIFY_API_KEY, TEMPLATE_ID } = process.env;

  await Promise.all(
    event.Records.map(async (record) => {
      try {
        assert(DLQ_URL, "DLQ_URL env variable not set");
        assert(NOTIFY_API_KEY, "NOTIFY_API_KEY env variable not set");
        assert(TEMPLATE_ID, "TEMPLATE_ID env variable not set");

        const notifyApiKey = await getSecret(NOTIFY_API_KEY, {
          maxAge: 900,
        });

        assert(notifyApiKey, `${NOTIFY_API_KEY} secret not retrieved`);

        const receivedEvent: SuspiciousActivityEvent = JSON.parse(
          record.Sns.Message
        );

        await sendConfMail(notifyApiKey as string, TEMPLATE_ID, receivedEvent);
      } catch (err) {
        console.error(`Error sending email for event`, err);
        const response = await sendSqsMessage(record.Sns.Message, DLQ_URL);
        console.error(
          `[Message sent to DLQ] with message id = ${response.MessageId}`,
          err as Error
        );
      }
    })
  );
};
