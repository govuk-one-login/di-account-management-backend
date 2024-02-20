import { SNSEvent } from "aws-lambda";
import { sendSqsMessage } from "./common/sqs";
import { SuspiciousActivityEvent, UserData } from "./common/model";
import assert from "node:assert/strict";
import { NotifyClient } from "notifications-node-client";
import "axios-debug-log";
import { getSecret } from "@aws-lambda-powertools/parameters/secrets";

export const flattenActivityObject = (
  activity: SuspiciousActivityEvent
): {
  activityData: Omit<SuspiciousActivityEvent, "user">;
  user: UserData;
} => {
  const { user, ...activityData } = activity;

  return { user, activityData };
};

export const validateSuspiciousActivity = (
  suspiciousActivityEvent: SuspiciousActivityEvent
): void => {
  assert(suspiciousActivityEvent.user?.email);
};

export const sendConfMail = async (
  apiKey: string,
  templateId: string,
  activity: SuspiciousActivityEvent
) => {
  console.log("sending email");
  const client = new NotifyClient(apiKey);
  console.log("created client");
  const { activityData, user } = flattenActivityObject(activity);
  console.log({
    ...activityData,
    ...user,
  });
  console.log("email", user.email);
  try {
    return client.sendEmail(templateId, user.email, {
      personalisation: {
        ...activityData,
        ...user,
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

        validateSuspiciousActivity(receivedEvent);

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
