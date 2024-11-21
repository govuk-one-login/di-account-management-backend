import { mockClient } from "aws-sdk-client-mock";
import { handler, lambdaClient } from "../redrive-delete-email-subscriptions";
import { SNSEvent, SQSMessageAttributes } from "aws-lambda";
import { SQSRecordAttributes } from "aws-lambda/trigger/sqs";
import { UserData } from "../common/model";
import { InvokeCommand } from "@aws-sdk/client-lambda";
import "aws-sdk-client-mock-jest";

describe("handler", () => {
  const mockLambdaClient = mockClient(lambdaClient);

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("that it successfully redrives the message", async () => {
    mockLambdaClient.on(InvokeCommand).resolves({
      StatusCode: 200,
    });
    const spyConsoleLog = jest.spyOn(global.console, "log");
    const userData: UserData = {
      user_id: "1",
      public_subject_id: "public",
      legacy_subject_id: "legacy",
    };
    const snsEvent = buildSnsEvent(userData);
    const sqsInput = buildSqsEvent(snsEvent);
    await handler(sqsInput);

    expect(spyConsoleLog).toHaveBeenCalledWith(
      "Redriving message with publicSubjectId: public, legacySubjectId: legacy"
    );
    expect(mockLambdaClient).toHaveReceivedCommandWith(InvokeCommand, {
      Payload: JSON.stringify(snsEvent),
    });
  });
});

function buildSnsEvent(userData: UserData): SNSEvent {
  return {
    Records: [
      {
        EventSource: "aws:sns",
        EventVersion: "1.0",
        EventSubscriptionArn: "",
        Sns: {
          Type: "",
          MessageId: "",
          TopicArn: "",
          Subject: "",
          Message: JSON.stringify(userData),
          Timestamp: "",
          SignatureVersion: "1",
          Signature: "",
          SigningCertUrl: "",
          UnsubscribeUrl: "",
          MessageAttributes: {},
        },
      },
    ],
  };
}

function buildSqsEvent(snsEvent: SNSEvent) {
  return {
    Records: [
      {
        messageId: "1",
        receiptHandle: "handle",
        body: JSON.stringify(snsEvent),
        attributes: {} as unknown as SQSRecordAttributes,
        messageAttributes: {} as unknown as SQSMessageAttributes,
        md5OfBody: "",
        eventSource: "",
        eventSourceARN: "",
        awsRegion: "",
      },
    ],
  };
}
