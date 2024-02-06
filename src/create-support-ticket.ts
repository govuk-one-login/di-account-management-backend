import { SNSEvent } from "aws-lambda";
import axios from "axios";
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
  SuspiciousActivityEvent,
} from "./common/model";
import { CREATE_TICKET_PATH } from "./common/constants";

export const formatCommentBody = (event: SuspiciousActivityEvent): string => {
  const htmlBody = [];
  const eventDateTime = new Date(event.timestamp * 1000);

  htmlBody.push(`<p><strong>Event Name</strong>: ${event.event_name}</p>`);

  if (event.event_id) {
    htmlBody.push(`<p><strong>Event ID</strong>: ${event.event_id}</p>`);
  }

  if (event.client_id) {
    htmlBody.push(`<p><strong>Client ID</strong>: ${event.client_id}</p>`);
  }

  if (event.timestamp) {
    htmlBody.push(
      `<p><strong>Date and Time</strong>: ${eventDateTime.toUTCString()}</p>`
    );
  }

  if (event.user?.user_id) {
    htmlBody.push(`<p><strong>User ID</strong>: ${event.user.user_id}</p>`);
  }

  if (event.user?.session_id) {
    htmlBody.push(
      `<p><strong>Session ID</strong>: ${event.user.session_id}</p>`
    );
  }

  if (event.user?.govuk_signin_journey_id) {
    htmlBody.push(
      `<p><strong>Gov UK Sign-in Journey ID</strong>: ${event.user.govuk_signin_journey_id}</p>`
    );
  }
  return htmlBody.join("");
};

export const validateSuspiciousActivity = (
  suspiciousActivityEvent: SuspiciousActivityEvent
): void => {
  if (
    suspiciousActivityEvent.event_id === undefined ||
    suspiciousActivityEvent.event_name === undefined ||
    suspiciousActivityEvent.user?.session_id === undefined ||
    suspiciousActivityEvent.user?.user_id === undefined ||
    suspiciousActivityEvent.client_id === undefined ||
    suspiciousActivityEvent.timestamp === undefined ||
    suspiciousActivityEvent.reported_suspicious === undefined
  ) {
    throw new Error("Could not validate Suspicious Event Body");
  }
};

export async function createTicket(
  ticket: CreateTicketPayload,
  apiUrl: string,
  apiUsername: string,
  apiToken: string
): Promise<void> {
  const token = `${apiUsername}:${apiToken}`;
  const instance = axios.create({
    baseURL: apiUrl,
    headers: {
      Authorization: `Basic ${Buffer.from(token).toString("base64")}`,
      "Content-Type": "application/json",
    },
  });

  try {
    await instance.post(CREATE_TICKET_PATH, ticket);
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

export const handler = async (event: SNSEvent): Promise<void> => {
  const {
    ZENDESK_GROUP_ID_KEY,
    ZENDESK_TAGS_KEY,
    ZENDESK_API_TOKEN_KEY,
    ZENDESK_API_USER_KEY,
    ZENDESK_API_URL_KEY,
    DLQ_URL,
  } = process.env;
  await Promise.all(
    event.Records.map(async (record) => {
      let eventIdentifier: string | undefined = undefined;
      try {
        const receivedEvent: SuspiciousActivityEvent = JSON.parse(
          record.Sns.Message
        );
        eventIdentifier = receivedEvent.event_id;
        if (
          !ZENDESK_API_USER_KEY ||
          !ZENDESK_API_TOKEN_KEY ||
          !ZENDESK_API_URL_KEY ||
          !ZENDESK_GROUP_ID_KEY
        ) {
          throw new Error(
            "Not all environment variables required to successfully send to Zendesk are provided."
          );
        }

        validateSuspiciousActivity(receivedEvent);
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
        const zendeskTicketTags = ZENDESK_TAGS_KEY
          ? await getSecret(ZENDESK_TAGS_KEY, {
              maxAge: 900,
            })
          : undefined;

        if (
          !zendeskUserName ||
          !zendeskUserPassword ||
          !zendeskGroupId ||
          !zendeskURL
        ) {
          throw new Error("Required zendesk secrets not configured");
        }

        const tags = (zendeskTicketTags as string)?.split(",");
        const ticket: CreateTicketPayload = {
          ticket: {
            subject: "REPORT_SUSPICIOUS_ACTIVITY -OLH TEST IGNORE",
            comment: {
              html_body: formatCommentBody(receivedEvent),
            },
            group_id: Number(zendeskGroupId),
            tags,
          },
        };

        await createTicket(
          ticket,
          zendeskURL as string,
          zendeskUserName as string,
          zendeskUserPassword as string
        );
      } catch (error: unknown) {
        console.error(
          `[Error occurred], unable to send suspicious activity event with ID: ${eventIdentifier} to Zendesk, ${
            (error as Error).message
          }`
        );
        const { AWS_REGION } = process.env;
        const client = new SQSClient({ region: AWS_REGION });
        const message: SendMessageRequest = {
          QueueUrl: DLQ_URL,
          MessageBody: record.Sns.Message,
        };
        const result = await client.send(new SendMessageCommand(message));
        console.error(
          `[Message sent to DLQ] with message id = ${result.MessageId}`,
          error
        );
      }
    })
  );
};
