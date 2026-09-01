import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { getEnvironmentVariable } from "./common/utils.js";
import { processConfig } from "./common/process-config.js";
import type {
  InactiveAccountTrackerRecord,
  InactiveAccountStatus,
} from "./common/model.js";
import { createHash } from "node:crypto";

const logger = new Logger();
const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(dynamoClient);
const lambdaClient = new LambdaClient({});

export interface TriggerInactiveAccountProcessEvent {
  emailAddress: string;
  processName: string;
  status?: InactiveAccountStatus;
  hasUndeliverableEmailAddress?: boolean;
  dateForDeletion?: string;
}

const calculateDateForDeletion = (processName: string): string => {
  const days = processConfig[processName].daysToDeletion[0];
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
};

export const handler = async (
  event: TriggerInactiveAccountProcessEvent
): Promise<void> => {
  const {
    emailAddress,
    processName,
    status,
    hasUndeliverableEmailAddress,
    dateForDeletion: dateForDeletionOverride,
  } = event;

  if (!emailAddress || !processName) {
    throw new Error("emailAddress and processName are required");
  }

  const config = processConfig[processName];
  if (!config) {
    throw new Error(
      `Unknown processName: ${processName}. Valid values: ${Object.keys(processConfig).join(", ")}`
    );
  }

  if (status && !config.allowedStatuses.includes(status)) {
    throw new Error(
      `Status "${status}" is not valid for process "${processName}". Allowed: ${config.allowedStatuses.join(", ")}`
    );
  }

  const tableName = getEnvironmentVariable(
    "INACTIVE_ACCOUNT_TRACKER_TABLE_NAME"
  );
  const queryAndDispatchFunctionName = getEnvironmentVariable(
    "QUERY_AND_DISPATCH_FUNCTION_NAME"
  );

  const commonSubjectId = `test-${createHash("sha256").update(emailAddress).digest("hex")}`;
  const dateForDeletion =
    dateForDeletionOverride ?? calculateDateForDeletion(processName);
  const now = new Date().toISOString();

  const record: InactiveAccountTrackerRecord = {
    dateForDeletion,
    commonSubjectId,
    publicSubjectId: `public-${commonSubjectId}`,
    emailAddress,
    emailAddressSource: "MANUAL_TEST",
    emailAddressLastUpdated: now,
    userLastActive: now,
    userLastActiveSource: "MANUAL_TEST",
    userLastActiveUpdated: now,
    status: status ?? config.allowedStatuses[0],
    statusLastUpdated: now,
    hasSetupMfa: false,
    ...(hasUndeliverableEmailAddress && { hasUndeliverableEmailAddress }),
  };

  await dynamoDocClient.send(
    new PutCommand({ TableName: tableName, Item: record })
  );

  logger.info("Inserted test record into tracker table", {
    commonSubjectId,
    dateForDeletion,
    processName,
    status: record.status,
  });

  await lambdaClient.send(
    new InvokeCommand({
      FunctionName: queryAndDispatchFunctionName,
      InvocationType: "RequestResponse",
      Payload: Buffer.from(
        JSON.stringify({ processName, manualTestOnly: true })
      ),
    })
  );

  logger.info("Invoked query-and-dispatch lambda", { processName });
};
