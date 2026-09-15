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

export const countAccountsForDate = async (
  tableName: string,
  dateForDeletion: string,
  options?: { includeMfaBreakdown?: boolean }
): Promise<AccountCountResult> => {
  if (options?.includeMfaBreakdown) {
    let total = 0;
    let withMfa = 0;

    for await (const page of paginatedQuery(
      tableName,
      dateForDeletion,
      "COUNT",
      {
        expression: "hasSetupMfa = :mfaVal",
        values: { ":mfaVal": true },
      }
    )) {
      total += page.scannedCount;
      withMfa += page.count;
    }

    return {
      total,
      withMfa,
      withoutMfa: total - withMfa,
    };
  }

  let count = 0;
  for await (const page of paginatedQuery(
    tableName,
    dateForDeletion,
    "COUNT"
  )) {
    count += page.count;
  }
  return {
    total: count,
  };
};

export interface AccountCountResult {
  total: number;
  withMfa?: number;
  withoutMfa?: number;
}
