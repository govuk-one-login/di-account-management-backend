import {
  ClientRegistry,
  Environment,
  ReportSuspiciousActivityEvent,
  RPClient,
} from "./common/model";
import assert from "node:assert/strict";
import { NotifyClient } from "notifications-node-client";
import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import clientRegistryEn from "./config/clientRegistry.en.json";
import clientRegistryCy from "./config/clientRegistry.cy.json";

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

  return registry[id];
};

const formatTimestamp = (timestamp: number, language: string) => {
  const date = new Date(timestamp);
  return {
    date: Intl.DateTimeFormat(language, {
      dateStyle: "long",
      timeZone: "Europe/London",
    }).format(date),
    time: Intl.DateTimeFormat(language, {
      timeStyle: "short",
      timeZone: "Europe/London",
    }).format(date),
  };
};

export const formatActivityObjectForEmail = (
  event: ReportSuspiciousActivityEvent
) => {
  const envName = process.env.ENVIRONMENT_NAME as Environment;
  assert(envName, "ENVIRONMENT_NAME env variable not set");

  assert(
    event.email_address,
    "Email address not present in Suspicious Activity Event"
  );

  const clientEn = getClientInfo(
    clientRegistryEn,
    envName,
    event.suspicious_activity.client_id
  );
  const clientCy = getClientInfo(
    clientRegistryCy,
    envName,
    event.suspicious_activity.client_id
  );

  assert(
    event.suspicious_activity.timestamp,
    "Timestamp not present in Suspicious Activity Event"
  );

  const datetimeEn = formatTimestamp(
    event.suspicious_activity.timestamp,
    "en-GB"
  );
  const datetimeCy = formatTimestamp(event.suspicious_activity.timestamp, "cy");

  return {
    email: event.email_address,
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
  event: ReportSuspiciousActivityEvent
) => {
  assert(event.zendesk_ticket_id);
  const notifyClient = new NotifyClient(apiKey);
  const { email, personalisation } = formatActivityObjectForEmail(event);

  return notifyClient.sendEmail(templateId, email, {
    personalisation,
    reference: event.zendesk_ticket_id,
  });
};

export const handler = async (
  event: ReportSuspiciousActivityEvent
): Promise<ReportSuspiciousActivityEvent> => {
  const { NOTIFY_API_KEY, TEMPLATE_ID } = process.env;
  try {
    assert(NOTIFY_API_KEY, "NOTIFY_API_KEY env variable not set");
    assert(TEMPLATE_ID, "TEMPLATE_ID env variable not set");

    const notifyApiKey = await getSecret(NOTIFY_API_KEY, {
      maxAge: 900,
    });

    assert(notifyApiKey, `${NOTIFY_API_KEY} secret not retrieved`);
    const response = await sendConfMail(
      notifyApiKey as string,
      TEMPLATE_ID,
      event
    );
    if (response?.data?.id) {
      event.notify_message_id = response.data.id;
    }
    return event;
  } catch (err) {
    console.error(`Error sending email for event`, err);
    throw new Error(`Error sending email for event: ${JSON.stringify(err)}`);
  }
};
