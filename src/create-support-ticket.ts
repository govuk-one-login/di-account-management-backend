import axios, { AxiosResponse } from "axios";
import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import {
  CreateTicketPayload,
  HttpError,
  ReportSuspiciousActivityEvent,
} from "./common/model";
import {
  CREATE_TICKET_PATH,
  SUSPICIOUS_ACTIVITY_EVENT_NAME,
} from "./common/constants";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { getEnvironmentVariable } from "./common/utils";
import { Logger } from "@aws-lambda-powertools/logger";
import type { Context } from "aws-lambda";

const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(dynamoClient);
const logger = new Logger();

export const formatCommentBody = (
  event: ReportSuspiciousActivityEvent
): string => {
  const htmlBody = [];

  if (event.email_address) {
    htmlBody.push(`<p><strong>Requester</strong>: ${event.email_address}</p>`);
  }

  htmlBody.push(
    `<p><strong>Event Name</strong>: ${event.suspicious_activity.event_type}</p>`
  );

  if (event.suspicious_activity.event_id) {
    htmlBody.push(
      `<p><strong>Event ID</strong>: ${event.suspicious_activity.event_id}</p>`
    );
  }

  if (event.suspicious_activity.timestamp) {
    htmlBody.push(
      `<p><strong>Reported Date and Time</strong>: ${new Date(
        event.suspicious_activity.timestamp * 1000
      ).toUTCString()}</p>`
    );
  }

  if (event.suspicious_activity.client_id) {
    htmlBody.push(
      `<p><strong>Client ID</strong>: ${event.suspicious_activity.client_id}</p>`
    );
  }

  if (event.suspicious_activity.user_id) {
    htmlBody.push(
      `<p><strong>User ID</strong>: ${event.suspicious_activity.user_id}</p>`
    );
  }

  if (event.suspicious_activity.session_id) {
    htmlBody.push(
      `<p><strong>Session ID</strong>: ${event.suspicious_activity.session_id}</p>`
    );
  }

  return htmlBody.join("");
};

export const validateSuspiciousActivity = (
  suspiciousActivityEvent: ReportSuspiciousActivityEvent
): void => {
  if (
    suspiciousActivityEvent.event_id === undefined ||
    suspiciousActivityEvent.event_type !== SUSPICIOUS_ACTIVITY_EVENT_NAME ||
    !suspiciousActivityEvent.suspicious_activity
  ) {
    throw new Error("Could not validate Suspicious Event Body");
  }
};

export async function createTicket(
  ticket: CreateTicketPayload,
  apiUrl: string,
  apiUsername: string,
  apiToken: string
): Promise<AxiosResponse> {
  const token = `${apiUsername}/token:${apiToken}`;
  const instance = axios.create({
    baseURL: apiUrl,
    headers: {
      Authorization: `Basic ${Buffer.from(token).toString("base64")}`,
      "Content-Type": "application/json",
    },
  });

  try {
    return await instance.post(CREATE_TICKET_PATH, ticket);
  } catch (error) {
    throw new Error(
      `${(error as HttpError).response.status} ${
        (error as HttpError).response.statusText
      }}`
    );
  }
}

export const handler = async (
  input: ReportSuspiciousActivityEvent,
  context: Context
): Promise<ReportSuspiciousActivityEvent> => {
  let eventIdentifier: string | undefined = undefined;
  try {
    logger.addContext(context);
    eventIdentifier = input.event_id;
    const ZENDESK_GROUP_ID_KEY = getEnvironmentVariable("ZENDESK_GROUP_ID_KEY");
    const ZENDESK_API_TOKEN_KEY = getEnvironmentVariable(
      "ZENDESK_API_TOKEN_KEY"
    );
    const ZENDESK_API_USER_KEY = getEnvironmentVariable("ZENDESK_API_USER_KEY");
    const ZENDESK_API_URL_KEY = getEnvironmentVariable("ZENDESK_API_URL_KEY");
    const ZENDESK_TICKET_FORM_ID = getEnvironmentVariable(
      "ZENDESK_TICKET_FORM_ID"
    );
    const ACTIVITY_LOG_TABLE = getEnvironmentVariable("ACTIVITY_LOG_TABLE");
    validateSuspiciousActivity(input);
    const zendeskUserName = await getSecret(ZENDESK_API_USER_KEY, {
      maxAge: 900,
    });
    const zendeskUserPassword = await getSecret(ZENDESK_API_TOKEN_KEY, {
      maxAge: 900,
    });
    const zendeskGroupId = await getSecret(ZENDESK_GROUP_ID_KEY, {
      maxAge: 900,
    });
    const zendeskURL = await getSecret(ZENDESK_API_URL_KEY, {
      maxAge: 900,
    });
    const zendeskTicketFormId = await getSecret(ZENDESK_TICKET_FORM_ID, {
      maxAge: 900,
    });

    let zendeskTicketTags: string | undefined;
    try {
      const ZENDESK_TAGS_KEY = getEnvironmentVariable("ZENDESK_TAGS_KEY");
      zendeskTicketTags = await getSecret(ZENDESK_TAGS_KEY, {
        maxAge: 900,
      });
    } catch {
      zendeskTicketTags = undefined;
    }

    if (
      !zendeskUserName ||
      !zendeskUserPassword ||
      !zendeskGroupId ||
      !zendeskURL ||
      !zendeskTicketFormId
    ) {
      throw new Error("Required zendesk secrets not configured");
    }

    const tags = (zendeskTicketTags as string)?.split(",");
    const ticket: CreateTicketPayload = {
      ticket: {
        subject: "One Login Home - Report Suspicious Activity",
        comment: {
          html_body: formatCommentBody(input),
        },
        group_id: Number(zendeskGroupId),
        tags,
        ticket_form_id: Number(zendeskTicketFormId),
      },
    };

    const axiosResponse = await createTicket(
      ticket,
      zendeskURL as string,
      zendeskUserName as string,
      zendeskUserPassword as string
    );
    if (axiosResponse.data?.ticket?.id) {
      input.zendesk_ticket_id = axiosResponse.data?.ticket?.id + "";
      if (input.zendesk_ticket_id) {
        await updateActivity(
          ACTIVITY_LOG_TABLE,
          input.suspicious_activity.user_id,
          input.suspicious_activity.event_id,
          input.zendesk_ticket_id
        );
      }
    }
    return input;
  } catch (error) {
    throw new Error(
      `Unable to send suspicious activity event with ID: ${eventIdentifier} to Zendesk, ${
        (error as Error).message
      }`
    );
  }
};

export const updateActivity = async (
  tableName: string,
  user_id: string,
  event_id: string,
  zendesk_ticket_id: string
) => {
  const command = new UpdateCommand({
    TableName: tableName,
    Key: {
      user_id,
      event_id,
    },
    UpdateExpression: "set zendesk_ticket_number = :zendesk_ticket_number",
    ExpressionAttributeValues: {
      ":zendesk_ticket_number": zendesk_ticket_id,
    },
  });

  return dynamoDocClient.send(command);
};
