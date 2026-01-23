import type { EventBridgeEvent, Context } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, paginateScan } from "@aws-sdk/lib-dynamodb";
import { S3Client, PutObjectCommand, S3ServiceException } from "@aws-sdk/client-s3";
import { Logger } from "@aws-lambda-powertools/logger";
import { ACTIVITY_LOG, YEAR, TIMESTAMP, DELETION_THRESHOLD_TIME } from "./common/constants";

const logger = new Logger();

const dynamoClient = new DynamoDBClient({});
const activityLogClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});

const lastActiveFiveYearsAgo: any[] = [];

const saveLastEvaluatedKey = async(lastEvaluatedKey: string | undefined): Promise<void> => {
    logger.info(`Saving last evaluated key: ${lastEvaluatedKey}`);
    const uploadCommand = new PutObjectCommand({
        Bucket: "inactive-accounts-logs",
        Key: "last-evaluated-key.txt",
        ACL: "private",
        Body: lastEvaluatedKey ? lastEvaluatedKey : "",
    });

    try {
        await s3Client.send(uploadCommand);
        logger.info("Successfully saved last evaluated key to S3");
    } catch (error) {
        if (error instanceof S3ServiceException) {
            logger.error("S3 Service Exception occurred while saving last evaluated key:", { error });
        } else {
            logger.error("An unexpected error occurred while saving last evaluated key:", { error });
        }
    }
}

const checkLastEvaluatedKey = async(): Promise<string | undefined> => {
    logger.info("Checking for last evaluated key in S3");
    const getCommand = new PutObjectCommand({
        Bucket: "inactive-accounts-logs",
        Key: "last-evaluated-key.txt",
    });

    try {
        const data = await s3Client.send(getCommand);
        const lastEvaluatedKey = await data.Body?.transformToString();
        logger.info(`Retrieved last evaluated key: ${lastEvaluatedKey}`);
        return lastEvaluatedKey;
    } catch (error) {
        if (error instanceof S3ServiceException && error.name === "NoSuchKey") {
            logger.info("No last evaluated key found in S3");
            return undefined;
        } else {
            logger.error("An unexpected error occurred while retrieving last evaluated key:", { error });
            throw error;
        }
    }
}

const getActivityHistory = async(): Promise<any[]> => {
    let lastEvaluatedKey = await checkLastEvaluatedKey();

    const params = {
        TableName: ACTIVITY_LOG,
        FilterExpression: `${YEAR} <= ${DELETION_THRESHOLD_TIME}`,
        ExpressionAttributeNames: {
            "#year": TIMESTAMP,
        },
        ExpressionAttributeValues: {
            ":fiveYearsAgo": new Date(new Date().setFullYear(new Date().getFullYear() - 5)).getMilliseconds(),
        },
        ExclusiveStartKey: lastEvaluatedKey ? { id: lastEvaluatedKey } : undefined,
    };

    const paginator = paginateScan({ client: activityLogClient }, params);

    try {
        for await (const page of paginator) {
            lastEvaluatedKey = page.LastEvaluatedKey as string | undefined;
            if (page.Items) {
                lastActiveFiveYearsAgo.push(...page.Items);
            }
        }
    } catch (error) {
        saveLastEvaluatedKey(lastEvaluatedKey);
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