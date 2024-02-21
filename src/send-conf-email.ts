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

const formatTimestamp = (timestamp: number, language: string) => {
  const date = new Date(timestamp);
  return {
    date: Intl.DateTimeFormat(language, { dateStyle: "long" }).format(date),
    time: Intl.DateTimeFormat(language, { timeStyle: "short" }).format(date),
  };
};

export const formatActivityObjectForEmail = (
  activity: SuspiciousActivityEvent
) => {
  const envName = process.env.ENVIRONMENT_NAME as Environment;
  assert(envName, "ENVIRONMENT_NAME env variable not set");

  assert(
    activity.user.email,
    "Email address not present in Suspicious Activity Event"
  );

  const clientEn = getClientInfo(clientRegistryEn, envName, activity.client_id);
  const clientCy = getClientInfo(clientRegistryCy, envName, activity.client_id);

  assert(
    activity.timestamp,
    "Timestamp not present in Suspicious Activity Event"
  );

  const datetimeEn = formatTimestamp(activity.timestamp, "en-GB");
  const datetimeCy = formatTimestamp(activity.timestamp, "cy");

  return {
    email: activity.user.email,
    personalisation: {
      clientNameEn: clientEn.header,
      clientNameCy: clientCy.header,
      dateEn: datetimeEn.date,
      dateCy: datetimeCy.date,
      timeEn: datetimeEn.time,
      timeCy: datetimeCy.time,
    },
  };
};

export const sendConfMail = async (
  apiKey: string,
  templateId: string,
  activity: SuspiciousActivityEvent
) => {
  const notifyClient = new NotifyClient(apiKey);
  const { email, personalisation } = formatActivityObjectForEmail(activity);

  return notifyClient.sendEmail(templateId, email, {
    personalisation,
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
