import {
  ClientRegistry,
  Environment,
  ReportSuspiciousActivityEvent,
  RPClient,
} from "./common/model";
import { homeClientIds } from "./common/constants";
import assert from "node:assert/strict";
import { NotifyClient } from "notifications-node-client";
import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import clientRegistryEn from "./config/clientRegistry.en.json";
import clientRegistryCy from "./config/clientRegistry.cy.json";
import { getEnvironmentVariable } from "./common/utils";

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
  const date = new Date(timestamp * 1000);
  return Intl.DateTimeFormat(language, {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h12",
    timeZone: "GB",
  }).format(date);
};

export const formatActivityObjectForEmail = (
  event: ReportSuspiciousActivityEvent
) => {
  const ENVIRONMENT_NAME = getEnvironmentVariable(
    "ENVIRONMENT_NAME"
  ) as Environment;

  assert(
    event.email_address,
    "Email address not present in Suspicious Activity Event"
  );

  const clientEn = getClientInfo(
    clientRegistryEn,
    ENVIRONMENT_NAME,
    event.suspicious_activity.client_id
  );
  const clientCy = getClientInfo(
    clientRegistryCy,
    ENVIRONMENT_NAME,
    event.suspicious_activity.client_id
  );

  assert(
    event.suspicious_activity.timestamp,
    "Timestamp not present in Suspicious Activity Event"
  );

  const suspicious_activity_timestamp: number =
    event.suspicious_activity.timestamp;

  const datetimeEn = formatTimestamp(suspicious_activity_timestamp, "en-GB");
  const datetimeCy = formatTimestamp(suspicious_activity_timestamp, "cy");

  assert(
    event.zendesk_ticket_id,
    "Zendesk ticket ID not present in Suspicious Activity Events"
  );

  return {
    email: event.email_address,
    personalisation: {
      clientNameEn: clientEn.header,
      clientNameCy: clientCy.header,
      dateEn: datetimeEn,
      dateCy: datetimeCy,
      ticketId: event.zendesk_ticket_id,
      showHomeHintText: homeClientIds.includes(
        event.suspicious_activity.client_id
      ),
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
  input: ReportSuspiciousActivityEvent
): Promise<ReportSuspiciousActivityEvent> => {
  const NOTIFY_API_KEY = getEnvironmentVariable("NOTIFY_API_KEY");
  const TEMPLATE_ID = getEnvironmentVariable("TEMPLATE_ID");
  try {
    console.log(`started processing event with ID: ${input.event_id}`);
    const notifyApiKey = await getSecret(NOTIFY_API_KEY, {
      maxAge: 900,
    });
    assert(notifyApiKey, `${NOTIFY_API_KEY} secret not retrieved`);
    const response = await sendConfMail(
      notifyApiKey as string,
      TEMPLATE_ID,
      input
    );
    if (response?.data?.id) {
      input.notify_message_id = response.data.id;
    }
    console.log(`finished processing event with ID: ${input.event_id}`);
    return input;
  } catch (err) {
    notifyErrorHandler(err as IError, "sending email for event");
    // redundant but TS keeps complaining about notifyErrorHandler return
    throw err;
  }
};

interface IErrorDetails {
  error: string;
  message: string;
}

interface IErrorResponse {
  status_code: 400 | 403 | 429 | 500;
  errors: IErrorDetails[];
}

export interface IError {
  response: { data: IErrorResponse };
}

const notifyErrorHandler = (err: IError, context: string): never => {
  if (err.response?.data) {
    const validStatusCodes: IErrorResponse["status_code"][] = [
      400, 403, 429, 500,
    ];
    if (validStatusCodes.includes(err.response?.data?.status_code)) {
      throw new Error(
        `Error ${context}: ${JSON.stringify(err.response?.data?.errors)}`
      );
    } else {
      const sanitisedError = { ...err, response: { ...err.response } };
      delete (sanitisedError.response as Partial<typeof err.response>).data;
      throw new Error(`Error ${context}: ${JSON.stringify(sanitisedError)}`);
    }
  }
  throw new Error(`Error ${context}`);
};
