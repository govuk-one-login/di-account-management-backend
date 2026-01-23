import type { EventBridgeEvent, Context } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, paginateScan } from "@aws-sdk/lib-dynamodb";
import { Logger } from "@aws-lambda-powertools/logger";
import { ACTIVITY_LOG, YEAR, TIMESTAMP, DELETION_THRESHOLD_TIME } from "./common/constants";

const logger = new Logger();

const dynamoClient = new DynamoDBClient({});
const activityLogClient = DynamoDBDocumentClient.from(dynamoClient);

const lastActiveFiveYearsAgo: any[] = [];

const getActivityHistory = async(): Promise<any[]> => {
    const params = {
        TableName: ACTIVITY_LOG,
        FilterExpression: `${YEAR} <= ${DELETION_THRESHOLD_TIME}`,
        ExpressionAttributeNames: {
            "#year": TIMESTAMP,
        },
        ExpressionAttributeValues: {
            ":fiveYearsAgo": new Date(new Date().setFullYear(new Date().getFullYear() - 5)).getMilliseconds(),
        },
    };

    const paginator = paginateScan({ client: activityLogClient }, params);

    try {
        for await (const page of paginator) {
            if (page.Items) {
                lastActiveFiveYearsAgo.push(...page.Items);
            }
        }
    } catch (error) {
        logger.error("Error paginating through activity log:", { error });
        throw error;
    }
    return lastActiveFiveYearsAgo;
}

export const handler = async (event: EventBridgeEvent, context: Context): Promise<any[]> => {
    logger.addContext(context);
    logger.info("Delete Inactive Accounts function invoked");
    const inactiveAccounts = await getActivityHistory();
    logger.info(`Found ${inactiveAccounts.length} inactive accounts for deletion processing`);
    return inactiveAccounts;
}