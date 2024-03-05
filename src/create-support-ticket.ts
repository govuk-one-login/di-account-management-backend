import axios, { AxiosResponse } from "axios";
import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import {
  SendMessageCommand,
  SendMessageCommandOutput,
  SendMessageRequest,
  SQSClient,
} from "@aws-sdk/client-sqs";
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

const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(dynamoClient);

export const formatCommentBody = (
  event: ReportSuspiciousActivityEvent
): string => {
  const htmlBody = [];

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
        event.suspicious_activity.timestamp
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
  const token = `${apiUsername}:${apiToken}`;
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
      } - creating ticket: ${JSON.stringify(ticket)}`
    );
  }
}

export const sendSqsMessage = async (
  messageBody: string,
  queueUrl: string | undefined
): Promise<SendMessageCommandOutput> => {
  const { AWS_REGION } = process.env;
  const client = new SQSClient({ region: AWS_REGION });
  const message: SendMessageRequest = {
    QueueUrl: queueUrl,
    MessageBody: messageBody,
  };
  return client.send(new SendMessageCommand(message));
};

export const handler = async (
  input: ReportSuspiciousActivityEvent
): Promise<ReportSuspiciousActivityEvent> => {
  const {
    ZENDESK_GROUP_ID_KEY,
    ZENDESK_TAGS_KEY,
    ZENDESK_API_TOKEN_KEY,
    ZENDESK_API_USER_KEY,
    ZENDESK_API_URL_KEY,
    ZENDESK_TICKET_FORM_ID,
    ACTIVITY_LOG_TABLE,
  } = process.env;
  let eventIdentifier: string | undefined = undefined;
  try {
    eventIdentifier = input.event_id;
    if (
      !ZENDESK_API_USER_KEY ||
      !ZENDESK_API_TOKEN_KEY ||
      !ZENDESK_API_URL_KEY ||
      !ZENDESK_GROUP_ID_KEY ||
      !ZENDESK_TICKET_FORM_ID ||
      !ACTIVITY_LOG_TABLE
    ) {
      throw new Error(
        "Not all environment variables required to successfully send to Zendesk are provided."
      );
    }

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
    const zendeskTicketTags = ZENDESK_TAGS_KEY
      ? await getSecret(ZENDESK_TAGS_KEY, {
          maxAge: 900,
        })
      : undefined;

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
        requester: { email: input.email_address, name: input.email_address },
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
  } catch (error: unknown) {
    console.error(
      `[Error occurred], unable to send suspicious activity event with ID: ${eventIdentifier} to Zendesk, ${
        (error as Error).message
      }`
    );
    throw new Error(
      `[Error occurred], unable to send suspicious activity event with ID: ${eventIdentifier} to Zendesk, ${
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
