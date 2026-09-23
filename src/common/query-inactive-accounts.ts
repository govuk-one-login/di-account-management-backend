import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { InactiveAccountTrackerRecord } from "./model.js";

const dynamoClient = new DynamoDBClient({});
const dynamoDocClient = DynamoDBDocumentClient.from(dynamoClient);

interface PaginatedQueryPage {
  items?: InactiveAccountTrackerRecord[];
  count: number;
  scannedCount: number;
}

interface QueryFilter {
  expression: string;
  values: Record<string, unknown>;
}

// Private — the ONLY place the QueryCommand is constructed for the
// InactiveAccountTrackerStore table. Both queryAccountsByDate and
// countAccountsForDate delegate to this so their query construction
// can never drift apart.
async function* paginatedQuery(
  tableName: string,
  dateForDeletion: string,
  select: "COUNT" | "ALL_ATTRIBUTES",
  filter?: QueryFilter
): AsyncGenerator<PaginatedQueryPage> {
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const expressionAttributeValues: Record<string, unknown> = {
      ":date": dateForDeletion,
    };
    if (filter) {
      Object.assign(expressionAttributeValues, filter.values);
    }

    const response = await dynamoDocClient.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "dateForDeletion = :date",
        ExpressionAttributeValues: expressionAttributeValues,
        ...(filter && { FilterExpression: filter.expression }),
        Select: select,
        ConsistentRead: false,
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    yield {
      items: response.Items as InactiveAccountTrackerRecord[] | undefined,
      count: response.Count ?? 0,
      scannedCount: response.ScannedCount ?? 0,
    };
    lastEvaluatedKey = response.LastEvaluatedKey ?? undefined;
  } while (lastEvaluatedKey);
}

export async function* queryAccountsByDate(
  tableName: string,
  dateForDeletion: string
): AsyncGenerator<InactiveAccountTrackerRecord[]> {
  for await (const page of paginatedQuery(
    tableName,
    dateForDeletion,
    "ALL_ATTRIBUTES"
  )) {
    if (page.items?.length) {
      yield page.items;
    }
  }
}

const countWithFilter = async (
  tableName: string,
  dateForDeletion: string,
  filter?: QueryFilter
): Promise<{ scannedTotal: number; filteredCount: number }> => {
  let scannedTotal = 0;
  let filteredCount = 0;
  for await (const page of paginatedQuery(
    tableName,
    dateForDeletion,
    "COUNT",
    filter
  )) {
    scannedTotal += page.scannedCount;
    filteredCount += page.count;
  }
  return { scannedTotal, filteredCount };
};

export const countAccountsForDate = async (
  tableName: string,
  dateForDeletion: string,
  options?: { includeSkipEmailReasonBreakdown?: boolean }
): Promise<AccountCountResult> => {
  if (!options?.includeSkipEmailReasonBreakdown) {
    const { filteredCount } = await countWithFilter(tableName, dateForDeletion);
    return { total: filteredCount };
  }

  const [noMfaResult, undeliverableResult] = await Promise.all([
    countWithFilter(tableName, dateForDeletion, {
      expression: "hasSetupMfa = :val",
      values: { ":val": false },
    }),
    countWithFilter(tableName, dateForDeletion, {
      expression: "hasUndeliverableEmailAddress = :val",
      values: { ":val": true },
    }),
  ]);

  const total = noMfaResult.scannedTotal;
  const skippedNoMfa = noMfaResult.filteredCount;
  const skippedUndeliverable = undeliverableResult.filteredCount;

  return {
    total,
    emailForecast: {
      willSendWarningEmails: total - skippedNoMfa - skippedUndeliverable,
      skippedNoMfa,
      skippedUndeliverable,
    },
  };
};

export interface AccountCountResult {
  total: number;
  emailForecast?: {
    willSendWarningEmails: number;
    skippedNoMfa: number;
    skippedUndeliverable: number;
  };
}
