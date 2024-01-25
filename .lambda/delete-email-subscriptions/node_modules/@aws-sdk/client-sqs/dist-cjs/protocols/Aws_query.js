"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.de_UntagQueueCommand = exports.de_TagQueueCommand = exports.de_StartMessageMoveTaskCommand = exports.de_SetQueueAttributesCommand = exports.de_SendMessageBatchCommand = exports.de_SendMessageCommand = exports.de_RemovePermissionCommand = exports.de_ReceiveMessageCommand = exports.de_PurgeQueueCommand = exports.de_ListQueueTagsCommand = exports.de_ListQueuesCommand = exports.de_ListMessageMoveTasksCommand = exports.de_ListDeadLetterSourceQueuesCommand = exports.de_GetQueueUrlCommand = exports.de_GetQueueAttributesCommand = exports.de_DeleteQueueCommand = exports.de_DeleteMessageBatchCommand = exports.de_DeleteMessageCommand = exports.de_CreateQueueCommand = exports.de_ChangeMessageVisibilityBatchCommand = exports.de_ChangeMessageVisibilityCommand = exports.de_CancelMessageMoveTaskCommand = exports.de_AddPermissionCommand = exports.se_UntagQueueCommand = exports.se_TagQueueCommand = exports.se_StartMessageMoveTaskCommand = exports.se_SetQueueAttributesCommand = exports.se_SendMessageBatchCommand = exports.se_SendMessageCommand = exports.se_RemovePermissionCommand = exports.se_ReceiveMessageCommand = exports.se_PurgeQueueCommand = exports.se_ListQueueTagsCommand = exports.se_ListQueuesCommand = exports.se_ListMessageMoveTasksCommand = exports.se_ListDeadLetterSourceQueuesCommand = exports.se_GetQueueUrlCommand = exports.se_GetQueueAttributesCommand = exports.se_DeleteQueueCommand = exports.se_DeleteMessageBatchCommand = exports.se_DeleteMessageCommand = exports.se_CreateQueueCommand = exports.se_ChangeMessageVisibilityBatchCommand = exports.se_ChangeMessageVisibilityCommand = exports.se_CancelMessageMoveTaskCommand = exports.se_AddPermissionCommand = void 0;
const protocol_http_1 = require("@smithy/protocol-http");
const smithy_client_1 = require("@smithy/smithy-client");
const fast_xml_parser_1 = require("fast-xml-parser");
const models_0_1 = require("../models/models_0");
const SQSServiceException_1 = require("../models/SQSServiceException");
const se_AddPermissionCommand = async (input, context) => {
    const headers = SHARED_HEADERS;
    let body;
    body = buildFormUrlencodedString({
        ...se_AddPermissionRequest(input, context),
        Action: "AddPermission",
        Version: "2012-11-05",
    });
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
exports.se_AddPermissionCommand = se_AddPermissionCommand;
const se_CancelMessageMoveTaskCommand = async (input, context) => {
    const headers = SHARED_HEADERS;
    let body;
    body = buildFormUrlencodedString({
        ...se_CancelMessageMoveTaskRequest(input, context),
        Action: "CancelMessageMoveTask",
        Version: "2012-11-05",
    });
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
exports.se_CancelMessageMoveTaskCommand = se_CancelMessageMoveTaskCommand;
const se_ChangeMessageVisibilityCommand = async (input, context) => {
    const headers = SHARED_HEADERS;
    let body;
    body = buildFormUrlencodedString({
        ...se_ChangeMessageVisibilityRequest(input, context),
        Action: "ChangeMessageVisibility",
        Version: "2012-11-05",
    });
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
exports.se_ChangeMessageVisibilityCommand = se_ChangeMessageVisibilityCommand;
const se_ChangeMessageVisibilityBatchCommand = async (input, context) => {
    const headers = SHARED_HEADERS;
    let body;
    body = buildFormUrlencodedString({
        ...se_ChangeMessageVisibilityBatchRequest(input, context),
        Action: "ChangeMessageVisibilityBatch",
        Version: "2012-11-05",
    });
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
exports.se_ChangeMessageVisibilityBatchCommand = se_ChangeMessageVisibilityBatchCommand;
const se_CreateQueueCommand = async (input, context) => {
    const headers = SHARED_HEADERS;
    let body;
    body = buildFormUrlencodedString({
        ...se_CreateQueueRequest(input, context),
        Action: "CreateQueue",
        Version: "2012-11-05",
    });
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
exports.se_CreateQueueCommand = se_CreateQueueCommand;
const se_DeleteMessageCommand = async (input, context) => {
    const headers = SHARED_HEADERS;
    let body;
    body = buildFormUrlencodedString({
        ...se_DeleteMessageRequest(input, context),
        Action: "DeleteMessage",
        Version: "2012-11-05",
    });
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
exports.se_DeleteMessageCommand = se_DeleteMessageCommand;
const se_DeleteMessageBatchCommand = async (input, context) => {
    const headers = SHARED_HEADERS;
    let body;
    body = buildFormUrlencodedString({
        ...se_DeleteMessageBatchRequest(input, context),
        Action: "DeleteMessageBatch",
        Version: "2012-11-05",
    });
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
exports.se_DeleteMessageBatchCommand = se_DeleteMessageBatchCommand;
const se_DeleteQueueCommand = async (input, context) => {
    const headers = SHARED_HEADERS;
    let body;
    body = buildFormUrlencodedString({
        ...se_DeleteQueueRequest(input, context),
        Action: "DeleteQueue",
        Version: "2012-11-05",
    });
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
exports.se_DeleteQueueCommand = se_DeleteQueueCommand;
const se_GetQueueAttributesCommand = async (input, context) => {
    const headers = SHARED_HEADERS;
    let body;
    body = buildFormUrlencodedString({
        ...se_GetQueueAttributesRequest(input, context),
        Action: "GetQueueAttributes",
        Version: "2012-11-05",
    });
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
exports.se_GetQueueAttributesCommand = se_GetQueueAttributesCommand;
const se_GetQueueUrlCommand = async (input, context) => {
    const headers = SHARED_HEADERS;
    let body;
    body = buildFormUrlencodedString({
        ...se_GetQueueUrlRequest(input, context),
        Action: "GetQueueUrl",
        Version: "2012-11-05",
    });
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
exports.se_GetQueueUrlCommand = se_GetQueueUrlCommand;
const se_ListDeadLetterSourceQueuesCommand = async (input, context) => {
    const headers = SHARED_HEADERS;
    let body;
    body = buildFormUrlencodedString({
        ...se_ListDeadLetterSourceQueuesRequest(input, context),
        Action: "ListDeadLetterSourceQueues",
        Version: "2012-11-05",
    });
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
exports.se_ListDeadLetterSourceQueuesCommand = se_ListDeadLetterSourceQueuesCommand;
const se_ListMessageMoveTasksCommand = async (input, context) => {
    const headers = SHARED_HEADERS;
    let body;
    body = buildFormUrlencodedString({
        ...se_ListMessageMoveTasksRequest(input, context),
        Action: "ListMessageMoveTasks",
        Version: "2012-11-05",
    });
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
exports.se_ListMessageMoveTasksCommand = se_ListMessageMoveTasksCommand;
const se_ListQueuesCommand = async (input, context) => {
    const headers = SHARED_HEADERS;
    let body;
    body = buildFormUrlencodedString({
        ...se_ListQueuesRequest(input, context),
        Action: "ListQueues",
        Version: "2012-11-05",
    });
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
exports.se_ListQueuesCommand = se_ListQueuesCommand;
const se_ListQueueTagsCommand = async (input, context) => {
    const headers = SHARED_HEADERS;
    let body;
    body = buildFormUrlencodedString({
        ...se_ListQueueTagsRequest(input, context),
        Action: "ListQueueTags",
        Version: "2012-11-05",
    });
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
exports.se_ListQueueTagsCommand = se_ListQueueTagsCommand;
const se_PurgeQueueCommand = async (input, context) => {
    const headers = SHARED_HEADERS;
    let body;
    body = buildFormUrlencodedString({
        ...se_PurgeQueueRequest(input, context),
        Action: "PurgeQueue",
        Version: "2012-11-05",
    });
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
exports.se_PurgeQueueCommand = se_PurgeQueueCommand;
const se_ReceiveMessageCommand = async (input, context) => {
    const headers = SHARED_HEADERS;
    let body;
    body = buildFormUrlencodedString({
        ...se_ReceiveMessageRequest(input, context),
        Action: "ReceiveMessage",
        Version: "2012-11-05",
    });
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
exports.se_ReceiveMessageCommand = se_ReceiveMessageCommand;
const se_RemovePermissionCommand = async (input, context) => {
    const headers = SHARED_HEADERS;
    let body;
    body = buildFormUrlencodedString({
        ...se_RemovePermissionRequest(input, context),
        Action: "RemovePermission",
        Version: "2012-11-05",
    });
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
exports.se_RemovePermissionCommand = se_RemovePermissionCommand;
const se_SendMessageCommand = async (input, context) => {
    const headers = SHARED_HEADERS;
    let body;
    body = buildFormUrlencodedString({
        ...se_SendMessageRequest(input, context),
        Action: "SendMessage",
        Version: "2012-11-05",
    });
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
exports.se_SendMessageCommand = se_SendMessageCommand;
const se_SendMessageBatchCommand = async (input, context) => {
    const headers = SHARED_HEADERS;
    let body;
    body = buildFormUrlencodedString({
        ...se_SendMessageBatchRequest(input, context),
        Action: "SendMessageBatch",
        Version: "2012-11-05",
    });
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
exports.se_SendMessageBatchCommand = se_SendMessageBatchCommand;
const se_SetQueueAttributesCommand = async (input, context) => {
    const headers = SHARED_HEADERS;
    let body;
    body = buildFormUrlencodedString({
        ...se_SetQueueAttributesRequest(input, context),
        Action: "SetQueueAttributes",
        Version: "2012-11-05",
    });
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
exports.se_SetQueueAttributesCommand = se_SetQueueAttributesCommand;
const se_StartMessageMoveTaskCommand = async (input, context) => {
    const headers = SHARED_HEADERS;
    let body;
    body = buildFormUrlencodedString({
        ...se_StartMessageMoveTaskRequest(input, context),
        Action: "StartMessageMoveTask",
        Version: "2012-11-05",
    });
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
exports.se_StartMessageMoveTaskCommand = se_StartMessageMoveTaskCommand;
const se_TagQueueCommand = async (input, context) => {
    const headers = SHARED_HEADERS;
    let body;
    body = buildFormUrlencodedString({
        ...se_TagQueueRequest(input, context),
        Action: "TagQueue",
        Version: "2012-11-05",
    });
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
exports.se_TagQueueCommand = se_TagQueueCommand;
const se_UntagQueueCommand = async (input, context) => {
    const headers = SHARED_HEADERS;
    let body;
    body = buildFormUrlencodedString({
        ...se_UntagQueueRequest(input, context),
        Action: "UntagQueue",
        Version: "2012-11-05",
    });
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
exports.se_UntagQueueCommand = se_UntagQueueCommand;
const de_AddPermissionCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_AddPermissionCommandError(output, context);
    }
    await (0, smithy_client_1.collectBody)(output.body, context);
    const response = {
        $metadata: deserializeMetadata(output),
    };
    return response;
};
exports.de_AddPermissionCommand = de_AddPermissionCommand;
const de_AddPermissionCommandError = async (output, context) => {
    const parsedOutput = {
        ...output,
        body: await parseErrorBody(output.body, context),
    };
    const errorCode = loadQueryErrorCode(output, parsedOutput.body);
    switch (errorCode) {
        case "OverLimit":
        case "com.amazonaws.sqs#OverLimit":
            throw await de_OverLimitRes(parsedOutput, context);
        default:
            const parsedBody = parsedOutput.body;
            return throwDefaultError({
                output,
                parsedBody: parsedBody.Error,
                errorCode,
            });
    }
};
const de_CancelMessageMoveTaskCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CancelMessageMoveTaskCommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_CancelMessageMoveTaskResult(data.CancelMessageMoveTaskResult, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
exports.de_CancelMessageMoveTaskCommand = de_CancelMessageMoveTaskCommand;
const de_CancelMessageMoveTaskCommandError = async (output, context) => {
    const parsedOutput = {
        ...output,
        body: await parseErrorBody(output.body, context),
    };
    const errorCode = loadQueryErrorCode(output, parsedOutput.body);
    switch (errorCode) {
        case "AWS.SimpleQueueService.UnsupportedOperation":
        case "com.amazonaws.sqs#UnsupportedOperation":
            throw await de_UnsupportedOperationRes(parsedOutput, context);
        case "ResourceNotFoundException":
        case "com.amazonaws.sqs#ResourceNotFoundException":
            throw await de_ResourceNotFoundExceptionRes(parsedOutput, context);
        default:
            const parsedBody = parsedOutput.body;
            return throwDefaultError({
                output,
                parsedBody: parsedBody.Error,
                errorCode,
            });
    }
};
const de_ChangeMessageVisibilityCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_ChangeMessageVisibilityCommandError(output, context);
    }
    await (0, smithy_client_1.collectBody)(output.body, context);
    const response = {
        $metadata: deserializeMetadata(output),
    };
    return response;
};
exports.de_ChangeMessageVisibilityCommand = de_ChangeMessageVisibilityCommand;
const de_ChangeMessageVisibilityCommandError = async (output, context) => {
    const parsedOutput = {
        ...output,
        body: await parseErrorBody(output.body, context),
    };
    const errorCode = loadQueryErrorCode(output, parsedOutput.body);
    switch (errorCode) {
        case "AWS.SimpleQueueService.MessageNotInflight":
        case "com.amazonaws.sqs#MessageNotInflight":
            throw await de_MessageNotInflightRes(parsedOutput, context);
        case "ReceiptHandleIsInvalid":
        case "com.amazonaws.sqs#ReceiptHandleIsInvalid":
            throw await de_ReceiptHandleIsInvalidRes(parsedOutput, context);
        default:
            const parsedBody = parsedOutput.body;
            return throwDefaultError({
                output,
                parsedBody: parsedBody.Error,
                errorCode,
            });
    }
};
const de_ChangeMessageVisibilityBatchCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_ChangeMessageVisibilityBatchCommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_ChangeMessageVisibilityBatchResult(data.ChangeMessageVisibilityBatchResult, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
exports.de_ChangeMessageVisibilityBatchCommand = de_ChangeMessageVisibilityBatchCommand;
const de_ChangeMessageVisibilityBatchCommandError = async (output, context) => {
    const parsedOutput = {
        ...output,
        body: await parseErrorBody(output.body, context),
    };
    const errorCode = loadQueryErrorCode(output, parsedOutput.body);
    switch (errorCode) {
        case "AWS.SimpleQueueService.BatchEntryIdsNotDistinct":
        case "com.amazonaws.sqs#BatchEntryIdsNotDistinct":
            throw await de_BatchEntryIdsNotDistinctRes(parsedOutput, context);
        case "AWS.SimpleQueueService.EmptyBatchRequest":
        case "com.amazonaws.sqs#EmptyBatchRequest":
            throw await de_EmptyBatchRequestRes(parsedOutput, context);
        case "AWS.SimpleQueueService.InvalidBatchEntryId":
        case "com.amazonaws.sqs#InvalidBatchEntryId":
            throw await de_InvalidBatchEntryIdRes(parsedOutput, context);
        case "AWS.SimpleQueueService.TooManyEntriesInBatchRequest":
        case "com.amazonaws.sqs#TooManyEntriesInBatchRequest":
            throw await de_TooManyEntriesInBatchRequestRes(parsedOutput, context);
        default:
            const parsedBody = parsedOutput.body;
            return throwDefaultError({
                output,
                parsedBody: parsedBody.Error,
                errorCode,
            });
    }
};
const de_CreateQueueCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CreateQueueCommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_CreateQueueResult(data.CreateQueueResult, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
exports.de_CreateQueueCommand = de_CreateQueueCommand;
const de_CreateQueueCommandError = async (output, context) => {
    const parsedOutput = {
        ...output,
        body: await parseErrorBody(output.body, context),
    };
    const errorCode = loadQueryErrorCode(output, parsedOutput.body);
    switch (errorCode) {
        case "AWS.SimpleQueueService.QueueDeletedRecently":
        case "com.amazonaws.sqs#QueueDeletedRecently":
            throw await de_QueueDeletedRecentlyRes(parsedOutput, context);
        case "QueueAlreadyExists":
        case "com.amazonaws.sqs#QueueNameExists":
            throw await de_QueueNameExistsRes(parsedOutput, context);
        default:
            const parsedBody = parsedOutput.body;
            return throwDefaultError({
                output,
                parsedBody: parsedBody.Error,
                errorCode,
            });
    }
};
const de_DeleteMessageCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_DeleteMessageCommandError(output, context);
    }
    await (0, smithy_client_1.collectBody)(output.body, context);
    const response = {
        $metadata: deserializeMetadata(output),
    };
    return response;
};
exports.de_DeleteMessageCommand = de_DeleteMessageCommand;
const de_DeleteMessageCommandError = async (output, context) => {
    const parsedOutput = {
        ...output,
        body: await parseErrorBody(output.body, context),
    };
    const errorCode = loadQueryErrorCode(output, parsedOutput.body);
    switch (errorCode) {
        case "InvalidIdFormat":
        case "com.amazonaws.sqs#InvalidIdFormat":
            throw await de_InvalidIdFormatRes(parsedOutput, context);
        case "ReceiptHandleIsInvalid":
        case "com.amazonaws.sqs#ReceiptHandleIsInvalid":
            throw await de_ReceiptHandleIsInvalidRes(parsedOutput, context);
        default:
            const parsedBody = parsedOutput.body;
            return throwDefaultError({
                output,
                parsedBody: parsedBody.Error,
                errorCode,
            });
    }
};
const de_DeleteMessageBatchCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_DeleteMessageBatchCommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_DeleteMessageBatchResult(data.DeleteMessageBatchResult, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
exports.de_DeleteMessageBatchCommand = de_DeleteMessageBatchCommand;
const de_DeleteMessageBatchCommandError = async (output, context) => {
    const parsedOutput = {
        ...output,
        body: await parseErrorBody(output.body, context),
    };
    const errorCode = loadQueryErrorCode(output, parsedOutput.body);
    switch (errorCode) {
        case "AWS.SimpleQueueService.BatchEntryIdsNotDistinct":
        case "com.amazonaws.sqs#BatchEntryIdsNotDistinct":
            throw await de_BatchEntryIdsNotDistinctRes(parsedOutput, context);
        case "AWS.SimpleQueueService.EmptyBatchRequest":
        case "com.amazonaws.sqs#EmptyBatchRequest":
            throw await de_EmptyBatchRequestRes(parsedOutput, context);
        case "AWS.SimpleQueueService.InvalidBatchEntryId":
        case "com.amazonaws.sqs#InvalidBatchEntryId":
            throw await de_InvalidBatchEntryIdRes(parsedOutput, context);
        case "AWS.SimpleQueueService.TooManyEntriesInBatchRequest":
        case "com.amazonaws.sqs#TooManyEntriesInBatchRequest":
            throw await de_TooManyEntriesInBatchRequestRes(parsedOutput, context);
        default:
            const parsedBody = parsedOutput.body;
            return throwDefaultError({
                output,
                parsedBody: parsedBody.Error,
                errorCode,
            });
    }
};
const de_DeleteQueueCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_DeleteQueueCommandError(output, context);
    }
    await (0, smithy_client_1.collectBody)(output.body, context);
    const response = {
        $metadata: deserializeMetadata(output),
    };
    return response;
};
exports.de_DeleteQueueCommand = de_DeleteQueueCommand;
const de_DeleteQueueCommandError = async (output, context) => {
    const parsedOutput = {
        ...output,
        body: await parseErrorBody(output.body, context),
    };
    const errorCode = loadQueryErrorCode(output, parsedOutput.body);
    const parsedBody = parsedOutput.body;
    return throwDefaultError({
        output,
        parsedBody: parsedBody.Error,
        errorCode,
    });
};
const de_GetQueueAttributesCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_GetQueueAttributesCommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_GetQueueAttributesResult(data.GetQueueAttributesResult, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
exports.de_GetQueueAttributesCommand = de_GetQueueAttributesCommand;
const de_GetQueueAttributesCommandError = async (output, context) => {
    const parsedOutput = {
        ...output,
        body: await parseErrorBody(output.body, context),
    };
    const errorCode = loadQueryErrorCode(output, parsedOutput.body);
    switch (errorCode) {
        case "InvalidAttributeName":
        case "com.amazonaws.sqs#InvalidAttributeName":
            throw await de_InvalidAttributeNameRes(parsedOutput, context);
        default:
            const parsedBody = parsedOutput.body;
            return throwDefaultError({
                output,
                parsedBody: parsedBody.Error,
                errorCode,
            });
    }
};
const de_GetQueueUrlCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_GetQueueUrlCommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_GetQueueUrlResult(data.GetQueueUrlResult, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
exports.de_GetQueueUrlCommand = de_GetQueueUrlCommand;
const de_GetQueueUrlCommandError = async (output, context) => {
    const parsedOutput = {
        ...output,
        body: await parseErrorBody(output.body, context),
    };
    const errorCode = loadQueryErrorCode(output, parsedOutput.body);
    switch (errorCode) {
        case "AWS.SimpleQueueService.NonExistentQueue":
        case "com.amazonaws.sqs#QueueDoesNotExist":
            throw await de_QueueDoesNotExistRes(parsedOutput, context);
        default:
            const parsedBody = parsedOutput.body;
            return throwDefaultError({
                output,
                parsedBody: parsedBody.Error,
                errorCode,
            });
    }
};
const de_ListDeadLetterSourceQueuesCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_ListDeadLetterSourceQueuesCommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_ListDeadLetterSourceQueuesResult(data.ListDeadLetterSourceQueuesResult, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
exports.de_ListDeadLetterSourceQueuesCommand = de_ListDeadLetterSourceQueuesCommand;
const de_ListDeadLetterSourceQueuesCommandError = async (output, context) => {
    const parsedOutput = {
        ...output,
        body: await parseErrorBody(output.body, context),
    };
    const errorCode = loadQueryErrorCode(output, parsedOutput.body);
    switch (errorCode) {
        case "AWS.SimpleQueueService.NonExistentQueue":
        case "com.amazonaws.sqs#QueueDoesNotExist":
            throw await de_QueueDoesNotExistRes(parsedOutput, context);
        default:
            const parsedBody = parsedOutput.body;
            return throwDefaultError({
                output,
                parsedBody: parsedBody.Error,
                errorCode,
            });
    }
};
const de_ListMessageMoveTasksCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_ListMessageMoveTasksCommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_ListMessageMoveTasksResult(data.ListMessageMoveTasksResult, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
exports.de_ListMessageMoveTasksCommand = de_ListMessageMoveTasksCommand;
const de_ListMessageMoveTasksCommandError = async (output, context) => {
    const parsedOutput = {
        ...output,
        body: await parseErrorBody(output.body, context),
    };
    const errorCode = loadQueryErrorCode(output, parsedOutput.body);
    switch (errorCode) {
        case "AWS.SimpleQueueService.UnsupportedOperation":
        case "com.amazonaws.sqs#UnsupportedOperation":
            throw await de_UnsupportedOperationRes(parsedOutput, context);
        case "ResourceNotFoundException":
        case "com.amazonaws.sqs#ResourceNotFoundException":
            throw await de_ResourceNotFoundExceptionRes(parsedOutput, context);
        default:
            const parsedBody = parsedOutput.body;
            return throwDefaultError({
                output,
                parsedBody: parsedBody.Error,
                errorCode,
            });
    }
};
const de_ListQueuesCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_ListQueuesCommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_ListQueuesResult(data.ListQueuesResult, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
exports.de_ListQueuesCommand = de_ListQueuesCommand;
const de_ListQueuesCommandError = async (output, context) => {
    const parsedOutput = {
        ...output,
        body: await parseErrorBody(output.body, context),
    };
    const errorCode = loadQueryErrorCode(output, parsedOutput.body);
    const parsedBody = parsedOutput.body;
    return throwDefaultError({
        output,
        parsedBody: parsedBody.Error,
        errorCode,
    });
};
const de_ListQueueTagsCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_ListQueueTagsCommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_ListQueueTagsResult(data.ListQueueTagsResult, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
exports.de_ListQueueTagsCommand = de_ListQueueTagsCommand;
const de_ListQueueTagsCommandError = async (output, context) => {
    const parsedOutput = {
        ...output,
        body: await parseErrorBody(output.body, context),
    };
    const errorCode = loadQueryErrorCode(output, parsedOutput.body);
    const parsedBody = parsedOutput.body;
    return throwDefaultError({
        output,
        parsedBody: parsedBody.Error,
        errorCode,
    });
};
const de_PurgeQueueCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_PurgeQueueCommandError(output, context);
    }
    await (0, smithy_client_1.collectBody)(output.body, context);
    const response = {
        $metadata: deserializeMetadata(output),
    };
    return response;
};
exports.de_PurgeQueueCommand = de_PurgeQueueCommand;
const de_PurgeQueueCommandError = async (output, context) => {
    const parsedOutput = {
        ...output,
        body: await parseErrorBody(output.body, context),
    };
    const errorCode = loadQueryErrorCode(output, parsedOutput.body);
    switch (errorCode) {
        case "AWS.SimpleQueueService.NonExistentQueue":
        case "com.amazonaws.sqs#QueueDoesNotExist":
            throw await de_QueueDoesNotExistRes(parsedOutput, context);
        case "AWS.SimpleQueueService.PurgeQueueInProgress":
        case "com.amazonaws.sqs#PurgeQueueInProgress":
            throw await de_PurgeQueueInProgressRes(parsedOutput, context);
        default:
            const parsedBody = parsedOutput.body;
            return throwDefaultError({
                output,
                parsedBody: parsedBody.Error,
                errorCode,
            });
    }
};
const de_ReceiveMessageCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_ReceiveMessageCommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_ReceiveMessageResult(data.ReceiveMessageResult, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
exports.de_ReceiveMessageCommand = de_ReceiveMessageCommand;
const de_ReceiveMessageCommandError = async (output, context) => {
    const parsedOutput = {
        ...output,
        body: await parseErrorBody(output.body, context),
    };
    const errorCode = loadQueryErrorCode(output, parsedOutput.body);
    switch (errorCode) {
        case "OverLimit":
        case "com.amazonaws.sqs#OverLimit":
            throw await de_OverLimitRes(parsedOutput, context);
        default:
            const parsedBody = parsedOutput.body;
            return throwDefaultError({
                output,
                parsedBody: parsedBody.Error,
                errorCode,
            });
    }
};
const de_RemovePermissionCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_RemovePermissionCommandError(output, context);
    }
    await (0, smithy_client_1.collectBody)(output.body, context);
    const response = {
        $metadata: deserializeMetadata(output),
    };
    return response;
};
exports.de_RemovePermissionCommand = de_RemovePermissionCommand;
const de_RemovePermissionCommandError = async (output, context) => {
    const parsedOutput = {
        ...output,
        body: await parseErrorBody(output.body, context),
    };
    const errorCode = loadQueryErrorCode(output, parsedOutput.body);
    const parsedBody = parsedOutput.body;
    return throwDefaultError({
        output,
        parsedBody: parsedBody.Error,
        errorCode,
    });
};
const de_SendMessageCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_SendMessageCommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_SendMessageResult(data.SendMessageResult, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
exports.de_SendMessageCommand = de_SendMessageCommand;
const de_SendMessageCommandError = async (output, context) => {
    const parsedOutput = {
        ...output,
        body: await parseErrorBody(output.body, context),
    };
    const errorCode = loadQueryErrorCode(output, parsedOutput.body);
    switch (errorCode) {
        case "AWS.SimpleQueueService.UnsupportedOperation":
        case "com.amazonaws.sqs#UnsupportedOperation":
            throw await de_UnsupportedOperationRes(parsedOutput, context);
        case "InvalidMessageContents":
        case "com.amazonaws.sqs#InvalidMessageContents":
            throw await de_InvalidMessageContentsRes(parsedOutput, context);
        default:
            const parsedBody = parsedOutput.body;
            return throwDefaultError({
                output,
                parsedBody: parsedBody.Error,
                errorCode,
            });
    }
};
const de_SendMessageBatchCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_SendMessageBatchCommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_SendMessageBatchResult(data.SendMessageBatchResult, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
exports.de_SendMessageBatchCommand = de_SendMessageBatchCommand;
const de_SendMessageBatchCommandError = async (output, context) => {
    const parsedOutput = {
        ...output,
        body: await parseErrorBody(output.body, context),
    };
    const errorCode = loadQueryErrorCode(output, parsedOutput.body);
    switch (errorCode) {
        case "AWS.SimpleQueueService.BatchEntryIdsNotDistinct":
        case "com.amazonaws.sqs#BatchEntryIdsNotDistinct":
            throw await de_BatchEntryIdsNotDistinctRes(parsedOutput, context);
        case "AWS.SimpleQueueService.BatchRequestTooLong":
        case "com.amazonaws.sqs#BatchRequestTooLong":
            throw await de_BatchRequestTooLongRes(parsedOutput, context);
        case "AWS.SimpleQueueService.EmptyBatchRequest":
        case "com.amazonaws.sqs#EmptyBatchRequest":
            throw await de_EmptyBatchRequestRes(parsedOutput, context);
        case "AWS.SimpleQueueService.InvalidBatchEntryId":
        case "com.amazonaws.sqs#InvalidBatchEntryId":
            throw await de_InvalidBatchEntryIdRes(parsedOutput, context);
        case "AWS.SimpleQueueService.TooManyEntriesInBatchRequest":
        case "com.amazonaws.sqs#TooManyEntriesInBatchRequest":
            throw await de_TooManyEntriesInBatchRequestRes(parsedOutput, context);
        case "AWS.SimpleQueueService.UnsupportedOperation":
        case "com.amazonaws.sqs#UnsupportedOperation":
            throw await de_UnsupportedOperationRes(parsedOutput, context);
        default:
            const parsedBody = parsedOutput.body;
            return throwDefaultError({
                output,
                parsedBody: parsedBody.Error,
                errorCode,
            });
    }
};
const de_SetQueueAttributesCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_SetQueueAttributesCommandError(output, context);
    }
    await (0, smithy_client_1.collectBody)(output.body, context);
    const response = {
        $metadata: deserializeMetadata(output),
    };
    return response;
};
exports.de_SetQueueAttributesCommand = de_SetQueueAttributesCommand;
const de_SetQueueAttributesCommandError = async (output, context) => {
    const parsedOutput = {
        ...output,
        body: await parseErrorBody(output.body, context),
    };
    const errorCode = loadQueryErrorCode(output, parsedOutput.body);
    switch (errorCode) {
        case "InvalidAttributeName":
        case "com.amazonaws.sqs#InvalidAttributeName":
            throw await de_InvalidAttributeNameRes(parsedOutput, context);
        default:
            const parsedBody = parsedOutput.body;
            return throwDefaultError({
                output,
                parsedBody: parsedBody.Error,
                errorCode,
            });
    }
};
const de_StartMessageMoveTaskCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_StartMessageMoveTaskCommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_StartMessageMoveTaskResult(data.StartMessageMoveTaskResult, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
exports.de_StartMessageMoveTaskCommand = de_StartMessageMoveTaskCommand;
const de_StartMessageMoveTaskCommandError = async (output, context) => {
    const parsedOutput = {
        ...output,
        body: await parseErrorBody(output.body, context),
    };
    const errorCode = loadQueryErrorCode(output, parsedOutput.body);
    switch (errorCode) {
        case "AWS.SimpleQueueService.UnsupportedOperation":
        case "com.amazonaws.sqs#UnsupportedOperation":
            throw await de_UnsupportedOperationRes(parsedOutput, context);
        case "ResourceNotFoundException":
        case "com.amazonaws.sqs#ResourceNotFoundException":
            throw await de_ResourceNotFoundExceptionRes(parsedOutput, context);
        default:
            const parsedBody = parsedOutput.body;
            return throwDefaultError({
                output,
                parsedBody: parsedBody.Error,
                errorCode,
            });
    }
};
const de_TagQueueCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_TagQueueCommandError(output, context);
    }
    await (0, smithy_client_1.collectBody)(output.body, context);
    const response = {
        $metadata: deserializeMetadata(output),
    };
    return response;
};
exports.de_TagQueueCommand = de_TagQueueCommand;
const de_TagQueueCommandError = async (output, context) => {
    const parsedOutput = {
        ...output,
        body: await parseErrorBody(output.body, context),
    };
    const errorCode = loadQueryErrorCode(output, parsedOutput.body);
    const parsedBody = parsedOutput.body;
    return throwDefaultError({
        output,
        parsedBody: parsedBody.Error,
        errorCode,
    });
};
const de_UntagQueueCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_UntagQueueCommandError(output, context);
    }
    await (0, smithy_client_1.collectBody)(output.body, context);
    const response = {
        $metadata: deserializeMetadata(output),
    };
    return response;
};
exports.de_UntagQueueCommand = de_UntagQueueCommand;
const de_UntagQueueCommandError = async (output, context) => {
    const parsedOutput = {
        ...output,
        body: await parseErrorBody(output.body, context),
    };
    const errorCode = loadQueryErrorCode(output, parsedOutput.body);
    const parsedBody = parsedOutput.body;
    return throwDefaultError({
        output,
        parsedBody: parsedBody.Error,
        errorCode,
    });
};
const de_BatchEntryIdsNotDistinctRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = de_BatchEntryIdsNotDistinct(body.Error, context);
    const exception = new models_0_1.BatchEntryIdsNotDistinct({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return (0, smithy_client_1.decorateServiceException)(exception, body);
};
const de_BatchRequestTooLongRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = de_BatchRequestTooLong(body.Error, context);
    const exception = new models_0_1.BatchRequestTooLong({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return (0, smithy_client_1.decorateServiceException)(exception, body);
};
const de_EmptyBatchRequestRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = de_EmptyBatchRequest(body.Error, context);
    const exception = new models_0_1.EmptyBatchRequest({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return (0, smithy_client_1.decorateServiceException)(exception, body);
};
const de_InvalidAttributeNameRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = de_InvalidAttributeName(body.Error, context);
    const exception = new models_0_1.InvalidAttributeName({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return (0, smithy_client_1.decorateServiceException)(exception, body);
};
const de_InvalidBatchEntryIdRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = de_InvalidBatchEntryId(body.Error, context);
    const exception = new models_0_1.InvalidBatchEntryId({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return (0, smithy_client_1.decorateServiceException)(exception, body);
};
const de_InvalidIdFormatRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = de_InvalidIdFormat(body.Error, context);
    const exception = new models_0_1.InvalidIdFormat({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return (0, smithy_client_1.decorateServiceException)(exception, body);
};
const de_InvalidMessageContentsRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = de_InvalidMessageContents(body.Error, context);
    const exception = new models_0_1.InvalidMessageContents({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return (0, smithy_client_1.decorateServiceException)(exception, body);
};
const de_MessageNotInflightRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = de_MessageNotInflight(body.Error, context);
    const exception = new models_0_1.MessageNotInflight({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return (0, smithy_client_1.decorateServiceException)(exception, body);
};
const de_OverLimitRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = de_OverLimit(body.Error, context);
    const exception = new models_0_1.OverLimit({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return (0, smithy_client_1.decorateServiceException)(exception, body);
};
const de_PurgeQueueInProgressRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = de_PurgeQueueInProgress(body.Error, context);
    const exception = new models_0_1.PurgeQueueInProgress({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return (0, smithy_client_1.decorateServiceException)(exception, body);
};
const de_QueueDeletedRecentlyRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = de_QueueDeletedRecently(body.Error, context);
    const exception = new models_0_1.QueueDeletedRecently({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return (0, smithy_client_1.decorateServiceException)(exception, body);
};
const de_QueueDoesNotExistRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = de_QueueDoesNotExist(body.Error, context);
    const exception = new models_0_1.QueueDoesNotExist({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return (0, smithy_client_1.decorateServiceException)(exception, body);
};
const de_QueueNameExistsRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = de_QueueNameExists(body.Error, context);
    const exception = new models_0_1.QueueNameExists({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return (0, smithy_client_1.decorateServiceException)(exception, body);
};
const de_ReceiptHandleIsInvalidRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = de_ReceiptHandleIsInvalid(body.Error, context);
    const exception = new models_0_1.ReceiptHandleIsInvalid({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return (0, smithy_client_1.decorateServiceException)(exception, body);
};
const de_ResourceNotFoundExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = de_ResourceNotFoundException(body.Error, context);
    const exception = new models_0_1.ResourceNotFoundException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return (0, smithy_client_1.decorateServiceException)(exception, body);
};
const de_TooManyEntriesInBatchRequestRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = de_TooManyEntriesInBatchRequest(body.Error, context);
    const exception = new models_0_1.TooManyEntriesInBatchRequest({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return (0, smithy_client_1.decorateServiceException)(exception, body);
};
const de_UnsupportedOperationRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = de_UnsupportedOperation(body.Error, context);
    const exception = new models_0_1.UnsupportedOperation({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return (0, smithy_client_1.decorateServiceException)(exception, body);
};
const se_ActionNameList = (input, context) => {
    const entries = {};
    let counter = 1;
    for (const entry of input) {
        if (entry === null) {
            continue;
        }
        entries[`member.${counter}`] = entry;
        counter++;
    }
    return entries;
};
const se_AddPermissionRequest = (input, context) => {
    const entries = {};
    if (input.QueueUrl != null) {
        entries["QueueUrl"] = input.QueueUrl;
    }
    if (input.Label != null) {
        entries["Label"] = input.Label;
    }
    if (input.AWSAccountIds != null) {
        const memberEntries = se_AWSAccountIdList(input.AWSAccountIds, context);
        if (input.AWSAccountIds?.length === 0) {
            entries.AWSAccountId = [];
        }
        Object.entries(memberEntries).forEach(([key, value]) => {
            const loc = `AWSAccountId.${key.substring(key.indexOf(".") + 1)}`;
            entries[loc] = value;
        });
    }
    if (input.Actions != null) {
        const memberEntries = se_ActionNameList(input.Actions, context);
        if (input.Actions?.length === 0) {
            entries.ActionName = [];
        }
        Object.entries(memberEntries).forEach(([key, value]) => {
            const loc = `ActionName.${key.substring(key.indexOf(".") + 1)}`;
            entries[loc] = value;
        });
    }
    return entries;
};
const se_AttributeNameList = (input, context) => {
    const entries = {};
    let counter = 1;
    for (const entry of input) {
        if (entry === null) {
            continue;
        }
        entries[`member.${counter}`] = entry;
        counter++;
    }
    return entries;
};
const se_AWSAccountIdList = (input, context) => {
    const entries = {};
    let counter = 1;
    for (const entry of input) {
        if (entry === null) {
            continue;
        }
        entries[`member.${counter}`] = entry;
        counter++;
    }
    return entries;
};
const se_BinaryList = (input, context) => {
    const entries = {};
    let counter = 1;
    for (const entry of input) {
        if (entry === null) {
            continue;
        }
        entries[`BinaryListValue.${counter}`] = context.base64Encoder(entry);
        counter++;
    }
    return entries;
};
const se_CancelMessageMoveTaskRequest = (input, context) => {
    const entries = {};
    if (input.TaskHandle != null) {
        entries["TaskHandle"] = input.TaskHandle;
    }
    return entries;
};
const se_ChangeMessageVisibilityBatchRequest = (input, context) => {
    const entries = {};
    if (input.QueueUrl != null) {
        entries["QueueUrl"] = input.QueueUrl;
    }
    if (input.Entries != null) {
        const memberEntries = se_ChangeMessageVisibilityBatchRequestEntryList(input.Entries, context);
        if (input.Entries?.length === 0) {
            entries.ChangeMessageVisibilityBatchRequestEntry = [];
        }
        Object.entries(memberEntries).forEach(([key, value]) => {
            const loc = `ChangeMessageVisibilityBatchRequestEntry.${key.substring(key.indexOf(".") + 1)}`;
            entries[loc] = value;
        });
    }
    return entries;
};
const se_ChangeMessageVisibilityBatchRequestEntry = (input, context) => {
    const entries = {};
    if (input.Id != null) {
        entries["Id"] = input.Id;
    }
    if (input.ReceiptHandle != null) {
        entries["ReceiptHandle"] = input.ReceiptHandle;
    }
    if (input.VisibilityTimeout != null) {
        entries["VisibilityTimeout"] = input.VisibilityTimeout;
    }
    return entries;
};
const se_ChangeMessageVisibilityBatchRequestEntryList = (input, context) => {
    const entries = {};
    let counter = 1;
    for (const entry of input) {
        if (entry === null) {
            continue;
        }
        const memberEntries = se_ChangeMessageVisibilityBatchRequestEntry(entry, context);
        Object.entries(memberEntries).forEach(([key, value]) => {
            entries[`member.${counter}.${key}`] = value;
        });
        counter++;
    }
    return entries;
};
const se_ChangeMessageVisibilityRequest = (input, context) => {
    const entries = {};
    if (input.QueueUrl != null) {
        entries["QueueUrl"] = input.QueueUrl;
    }
    if (input.ReceiptHandle != null) {
        entries["ReceiptHandle"] = input.ReceiptHandle;
    }
    if (input.VisibilityTimeout != null) {
        entries["VisibilityTimeout"] = input.VisibilityTimeout;
    }
    return entries;
};
const se_CreateQueueRequest = (input, context) => {
    const entries = {};
    if (input.QueueName != null) {
        entries["QueueName"] = input.QueueName;
    }
    if (input.tags != null) {
        const memberEntries = se_TagMap(input.tags, context);
        Object.entries(memberEntries).forEach(([key, value]) => {
            const loc = `Tag.${key.substring(key.indexOf(".") + 1)}`;
            entries[loc] = value;
        });
    }
    if (input.Attributes != null) {
        const memberEntries = se_QueueAttributeMap(input.Attributes, context);
        Object.entries(memberEntries).forEach(([key, value]) => {
            const loc = `Attribute.${key.substring(key.indexOf(".") + 1)}`;
            entries[loc] = value;
        });
    }
    return entries;
};
const se_DeleteMessageBatchRequest = (input, context) => {
    const entries = {};
    if (input.QueueUrl != null) {
        entries["QueueUrl"] = input.QueueUrl;
    }
    if (input.Entries != null) {
        const memberEntries = se_DeleteMessageBatchRequestEntryList(input.Entries, context);
        if (input.Entries?.length === 0) {
            entries.DeleteMessageBatchRequestEntry = [];
        }
        Object.entries(memberEntries).forEach(([key, value]) => {
            const loc = `DeleteMessageBatchRequestEntry.${key.substring(key.indexOf(".") + 1)}`;
            entries[loc] = value;
        });
    }
    return entries;
};
const se_DeleteMessageBatchRequestEntry = (input, context) => {
    const entries = {};
    if (input.Id != null) {
        entries["Id"] = input.Id;
    }
    if (input.ReceiptHandle != null) {
        entries["ReceiptHandle"] = input.ReceiptHandle;
    }
    return entries;
};
const se_DeleteMessageBatchRequestEntryList = (input, context) => {
    const entries = {};
    let counter = 1;
    for (const entry of input) {
        if (entry === null) {
            continue;
        }
        const memberEntries = se_DeleteMessageBatchRequestEntry(entry, context);
        Object.entries(memberEntries).forEach(([key, value]) => {
            entries[`member.${counter}.${key}`] = value;
        });
        counter++;
    }
    return entries;
};
const se_DeleteMessageRequest = (input, context) => {
    const entries = {};
    if (input.QueueUrl != null) {
        entries["QueueUrl"] = input.QueueUrl;
    }
    if (input.ReceiptHandle != null) {
        entries["ReceiptHandle"] = input.ReceiptHandle;
    }
    return entries;
};
const se_DeleteQueueRequest = (input, context) => {
    const entries = {};
    if (input.QueueUrl != null) {
        entries["QueueUrl"] = input.QueueUrl;
    }
    return entries;
};
const se_GetQueueAttributesRequest = (input, context) => {
    const entries = {};
    if (input.QueueUrl != null) {
        entries["QueueUrl"] = input.QueueUrl;
    }
    if (input.AttributeNames != null) {
        const memberEntries = se_AttributeNameList(input.AttributeNames, context);
        if (input.AttributeNames?.length === 0) {
            entries.AttributeName = [];
        }
        Object.entries(memberEntries).forEach(([key, value]) => {
            const loc = `AttributeName.${key.substring(key.indexOf(".") + 1)}`;
            entries[loc] = value;
        });
    }
    return entries;
};
const se_GetQueueUrlRequest = (input, context) => {
    const entries = {};
    if (input.QueueName != null) {
        entries["QueueName"] = input.QueueName;
    }
    if (input.QueueOwnerAWSAccountId != null) {
        entries["QueueOwnerAWSAccountId"] = input.QueueOwnerAWSAccountId;
    }
    return entries;
};
const se_ListDeadLetterSourceQueuesRequest = (input, context) => {
    const entries = {};
    if (input.QueueUrl != null) {
        entries["QueueUrl"] = input.QueueUrl;
    }
    if (input.NextToken != null) {
        entries["NextToken"] = input.NextToken;
    }
    if (input.MaxResults != null) {
        entries["MaxResults"] = input.MaxResults;
    }
    return entries;
};
const se_ListMessageMoveTasksRequest = (input, context) => {
    const entries = {};
    if (input.SourceArn != null) {
        entries["SourceArn"] = input.SourceArn;
    }
    if (input.MaxResults != null) {
        entries["MaxResults"] = input.MaxResults;
    }
    return entries;
};
const se_ListQueuesRequest = (input, context) => {
    const entries = {};
    if (input.QueueNamePrefix != null) {
        entries["QueueNamePrefix"] = input.QueueNamePrefix;
    }
    if (input.NextToken != null) {
        entries["NextToken"] = input.NextToken;
    }
    if (input.MaxResults != null) {
        entries["MaxResults"] = input.MaxResults;
    }
    return entries;
};
const se_ListQueueTagsRequest = (input, context) => {
    const entries = {};
    if (input.QueueUrl != null) {
        entries["QueueUrl"] = input.QueueUrl;
    }
    return entries;
};
const se_MessageAttributeNameList = (input, context) => {
    const entries = {};
    let counter = 1;
    for (const entry of input) {
        if (entry === null) {
            continue;
        }
        entries[`member.${counter}`] = entry;
        counter++;
    }
    return entries;
};
const se_MessageAttributeValue = (input, context) => {
    const entries = {};
    if (input.StringValue != null) {
        entries["StringValue"] = input.StringValue;
    }
    if (input.BinaryValue != null) {
        entries["BinaryValue"] = context.base64Encoder(input.BinaryValue);
    }
    if (input.StringListValues != null) {
        const memberEntries = se_StringList(input.StringListValues, context);
        if (input.StringListValues?.length === 0) {
            entries.StringListValue = [];
        }
        Object.entries(memberEntries).forEach(([key, value]) => {
            const loc = `StringListValue.${key.substring(key.indexOf(".") + 1)}`;
            entries[loc] = value;
        });
    }
    if (input.BinaryListValues != null) {
        const memberEntries = se_BinaryList(input.BinaryListValues, context);
        if (input.BinaryListValues?.length === 0) {
            entries.BinaryListValue = [];
        }
        Object.entries(memberEntries).forEach(([key, value]) => {
            const loc = `BinaryListValue.${key.substring(key.indexOf(".") + 1)}`;
            entries[loc] = value;
        });
    }
    if (input.DataType != null) {
        entries["DataType"] = input.DataType;
    }
    return entries;
};
const se_MessageBodyAttributeMap = (input, context) => {
    const entries = {};
    let counter = 1;
    Object.keys(input)
        .filter((key) => input[key] != null)
        .forEach((key) => {
        entries[`entry.${counter}.Name`] = key;
        const memberEntries = se_MessageAttributeValue(input[key], context);
        Object.entries(memberEntries).forEach(([key, value]) => {
            entries[`entry.${counter}.Value.${key}`] = value;
        });
        counter++;
    });
    return entries;
};
const se_MessageBodySystemAttributeMap = (input, context) => {
    const entries = {};
    let counter = 1;
    Object.keys(input)
        .filter((key) => input[key] != null)
        .forEach((key) => {
        entries[`entry.${counter}.Name`] = key;
        const memberEntries = se_MessageSystemAttributeValue(input[key], context);
        Object.entries(memberEntries).forEach(([key, value]) => {
            entries[`entry.${counter}.Value.${key}`] = value;
        });
        counter++;
    });
    return entries;
};
const se_MessageSystemAttributeValue = (input, context) => {
    const entries = {};
    if (input.StringValue != null) {
        entries["StringValue"] = input.StringValue;
    }
    if (input.BinaryValue != null) {
        entries["BinaryValue"] = context.base64Encoder(input.BinaryValue);
    }
    if (input.StringListValues != null) {
        const memberEntries = se_StringList(input.StringListValues, context);
        if (input.StringListValues?.length === 0) {
            entries.StringListValue = [];
        }
        Object.entries(memberEntries).forEach(([key, value]) => {
            const loc = `StringListValue.${key.substring(key.indexOf(".") + 1)}`;
            entries[loc] = value;
        });
    }
    if (input.BinaryListValues != null) {
        const memberEntries = se_BinaryList(input.BinaryListValues, context);
        if (input.BinaryListValues?.length === 0) {
            entries.BinaryListValue = [];
        }
        Object.entries(memberEntries).forEach(([key, value]) => {
            const loc = `BinaryListValue.${key.substring(key.indexOf(".") + 1)}`;
            entries[loc] = value;
        });
    }
    if (input.DataType != null) {
        entries["DataType"] = input.DataType;
    }
    return entries;
};
const se_PurgeQueueRequest = (input, context) => {
    const entries = {};
    if (input.QueueUrl != null) {
        entries["QueueUrl"] = input.QueueUrl;
    }
    return entries;
};
const se_QueueAttributeMap = (input, context) => {
    const entries = {};
    let counter = 1;
    Object.keys(input)
        .filter((key) => input[key] != null)
        .forEach((key) => {
        entries[`entry.${counter}.Name`] = key;
        entries[`entry.${counter}.Value`] = input[key];
        counter++;
    });
    return entries;
};
const se_ReceiveMessageRequest = (input, context) => {
    const entries = {};
    if (input.QueueUrl != null) {
        entries["QueueUrl"] = input.QueueUrl;
    }
    if (input.AttributeNames != null) {
        const memberEntries = se_AttributeNameList(input.AttributeNames, context);
        if (input.AttributeNames?.length === 0) {
            entries.AttributeName = [];
        }
        Object.entries(memberEntries).forEach(([key, value]) => {
            const loc = `AttributeName.${key.substring(key.indexOf(".") + 1)}`;
            entries[loc] = value;
        });
    }
    if (input.MessageAttributeNames != null) {
        const memberEntries = se_MessageAttributeNameList(input.MessageAttributeNames, context);
        if (input.MessageAttributeNames?.length === 0) {
            entries.MessageAttributeName = [];
        }
        Object.entries(memberEntries).forEach(([key, value]) => {
            const loc = `MessageAttributeName.${key.substring(key.indexOf(".") + 1)}`;
            entries[loc] = value;
        });
    }
    if (input.MaxNumberOfMessages != null) {
        entries["MaxNumberOfMessages"] = input.MaxNumberOfMessages;
    }
    if (input.VisibilityTimeout != null) {
        entries["VisibilityTimeout"] = input.VisibilityTimeout;
    }
    if (input.WaitTimeSeconds != null) {
        entries["WaitTimeSeconds"] = input.WaitTimeSeconds;
    }
    if (input.ReceiveRequestAttemptId != null) {
        entries["ReceiveRequestAttemptId"] = input.ReceiveRequestAttemptId;
    }
    return entries;
};
const se_RemovePermissionRequest = (input, context) => {
    const entries = {};
    if (input.QueueUrl != null) {
        entries["QueueUrl"] = input.QueueUrl;
    }
    if (input.Label != null) {
        entries["Label"] = input.Label;
    }
    return entries;
};
const se_SendMessageBatchRequest = (input, context) => {
    const entries = {};
    if (input.QueueUrl != null) {
        entries["QueueUrl"] = input.QueueUrl;
    }
    if (input.Entries != null) {
        const memberEntries = se_SendMessageBatchRequestEntryList(input.Entries, context);
        if (input.Entries?.length === 0) {
            entries.SendMessageBatchRequestEntry = [];
        }
        Object.entries(memberEntries).forEach(([key, value]) => {
            const loc = `SendMessageBatchRequestEntry.${key.substring(key.indexOf(".") + 1)}`;
            entries[loc] = value;
        });
    }
    return entries;
};
const se_SendMessageBatchRequestEntry = (input, context) => {
    const entries = {};
    if (input.Id != null) {
        entries["Id"] = input.Id;
    }
    if (input.MessageBody != null) {
        entries["MessageBody"] = input.MessageBody;
    }
    if (input.DelaySeconds != null) {
        entries["DelaySeconds"] = input.DelaySeconds;
    }
    if (input.MessageAttributes != null) {
        const memberEntries = se_MessageBodyAttributeMap(input.MessageAttributes, context);
        Object.entries(memberEntries).forEach(([key, value]) => {
            const loc = `MessageAttribute.${key.substring(key.indexOf(".") + 1)}`;
            entries[loc] = value;
        });
    }
    if (input.MessageSystemAttributes != null) {
        const memberEntries = se_MessageBodySystemAttributeMap(input.MessageSystemAttributes, context);
        Object.entries(memberEntries).forEach(([key, value]) => {
            const loc = `MessageSystemAttribute.${key.substring(key.indexOf(".") + 1)}`;
            entries[loc] = value;
        });
    }
    if (input.MessageDeduplicationId != null) {
        entries["MessageDeduplicationId"] = input.MessageDeduplicationId;
    }
    if (input.MessageGroupId != null) {
        entries["MessageGroupId"] = input.MessageGroupId;
    }
    return entries;
};
const se_SendMessageBatchRequestEntryList = (input, context) => {
    const entries = {};
    let counter = 1;
    for (const entry of input) {
        if (entry === null) {
            continue;
        }
        const memberEntries = se_SendMessageBatchRequestEntry(entry, context);
        Object.entries(memberEntries).forEach(([key, value]) => {
            entries[`member.${counter}.${key}`] = value;
        });
        counter++;
    }
    return entries;
};
const se_SendMessageRequest = (input, context) => {
    const entries = {};
    if (input.QueueUrl != null) {
        entries["QueueUrl"] = input.QueueUrl;
    }
    if (input.MessageBody != null) {
        entries["MessageBody"] = input.MessageBody;
    }
    if (input.DelaySeconds != null) {
        entries["DelaySeconds"] = input.DelaySeconds;
    }
    if (input.MessageAttributes != null) {
        const memberEntries = se_MessageBodyAttributeMap(input.MessageAttributes, context);
        Object.entries(memberEntries).forEach(([key, value]) => {
            const loc = `MessageAttribute.${key.substring(key.indexOf(".") + 1)}`;
            entries[loc] = value;
        });
    }
    if (input.MessageSystemAttributes != null) {
        const memberEntries = se_MessageBodySystemAttributeMap(input.MessageSystemAttributes, context);
        Object.entries(memberEntries).forEach(([key, value]) => {
            const loc = `MessageSystemAttribute.${key.substring(key.indexOf(".") + 1)}`;
            entries[loc] = value;
        });
    }
    if (input.MessageDeduplicationId != null) {
        entries["MessageDeduplicationId"] = input.MessageDeduplicationId;
    }
    if (input.MessageGroupId != null) {
        entries["MessageGroupId"] = input.MessageGroupId;
    }
    return entries;
};
const se_SetQueueAttributesRequest = (input, context) => {
    const entries = {};
    if (input.QueueUrl != null) {
        entries["QueueUrl"] = input.QueueUrl;
    }
    if (input.Attributes != null) {
        const memberEntries = se_QueueAttributeMap(input.Attributes, context);
        Object.entries(memberEntries).forEach(([key, value]) => {
            const loc = `Attribute.${key.substring(key.indexOf(".") + 1)}`;
            entries[loc] = value;
        });
    }
    return entries;
};
const se_StartMessageMoveTaskRequest = (input, context) => {
    const entries = {};
    if (input.SourceArn != null) {
        entries["SourceArn"] = input.SourceArn;
    }
    if (input.DestinationArn != null) {
        entries["DestinationArn"] = input.DestinationArn;
    }
    if (input.MaxNumberOfMessagesPerSecond != null) {
        entries["MaxNumberOfMessagesPerSecond"] = input.MaxNumberOfMessagesPerSecond;
    }
    return entries;
};
const se_StringList = (input, context) => {
    const entries = {};
    let counter = 1;
    for (const entry of input) {
        if (entry === null) {
            continue;
        }
        entries[`StringListValue.${counter}`] = entry;
        counter++;
    }
    return entries;
};
const se_TagKeyList = (input, context) => {
    const entries = {};
    let counter = 1;
    for (const entry of input) {
        if (entry === null) {
            continue;
        }
        entries[`member.${counter}`] = entry;
        counter++;
    }
    return entries;
};
const se_TagMap = (input, context) => {
    const entries = {};
    let counter = 1;
    Object.keys(input)
        .filter((key) => input[key] != null)
        .forEach((key) => {
        entries[`entry.${counter}.Key`] = key;
        entries[`entry.${counter}.Value`] = input[key];
        counter++;
    });
    return entries;
};
const se_TagQueueRequest = (input, context) => {
    const entries = {};
    if (input.QueueUrl != null) {
        entries["QueueUrl"] = input.QueueUrl;
    }
    if (input.Tags != null) {
        const memberEntries = se_TagMap(input.Tags, context);
        Object.entries(memberEntries).forEach(([key, value]) => {
            const loc = `Tag.${key.substring(key.indexOf(".") + 1)}`;
            entries[loc] = value;
        });
    }
    return entries;
};
const se_UntagQueueRequest = (input, context) => {
    const entries = {};
    if (input.QueueUrl != null) {
        entries["QueueUrl"] = input.QueueUrl;
    }
    if (input.TagKeys != null) {
        const memberEntries = se_TagKeyList(input.TagKeys, context);
        if (input.TagKeys?.length === 0) {
            entries.TagKey = [];
        }
        Object.entries(memberEntries).forEach(([key, value]) => {
            const loc = `TagKey.${key.substring(key.indexOf(".") + 1)}`;
            entries[loc] = value;
        });
    }
    return entries;
};
const de_BatchEntryIdsNotDistinct = (output, context) => {
    const contents = {};
    return contents;
};
const de_BatchRequestTooLong = (output, context) => {
    const contents = {};
    return contents;
};
const de_BatchResultErrorEntry = (output, context) => {
    const contents = {};
    if (output["Id"] !== undefined) {
        contents.Id = (0, smithy_client_1.expectString)(output["Id"]);
    }
    if (output["SenderFault"] !== undefined) {
        contents.SenderFault = (0, smithy_client_1.parseBoolean)(output["SenderFault"]);
    }
    if (output["Code"] !== undefined) {
        contents.Code = (0, smithy_client_1.expectString)(output["Code"]);
    }
    if (output["Message"] !== undefined) {
        contents.Message = (0, smithy_client_1.expectString)(output["Message"]);
    }
    return contents;
};
const de_BatchResultErrorEntryList = (output, context) => {
    return (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_BatchResultErrorEntry(entry, context);
    });
};
const de_BinaryList = (output, context) => {
    return (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return context.base64Decoder(entry);
    });
};
const de_CancelMessageMoveTaskResult = (output, context) => {
    const contents = {};
    if (output["ApproximateNumberOfMessagesMoved"] !== undefined) {
        contents.ApproximateNumberOfMessagesMoved = (0, smithy_client_1.strictParseLong)(output["ApproximateNumberOfMessagesMoved"]);
    }
    return contents;
};
const de_ChangeMessageVisibilityBatchResult = (output, context) => {
    const contents = {};
    if (output.ChangeMessageVisibilityBatchResultEntry === "") {
        contents.Successful = [];
    }
    else if (output["ChangeMessageVisibilityBatchResultEntry"] !== undefined) {
        contents.Successful = de_ChangeMessageVisibilityBatchResultEntryList((0, smithy_client_1.getArrayIfSingleItem)(output["ChangeMessageVisibilityBatchResultEntry"]), context);
    }
    if (output.BatchResultErrorEntry === "") {
        contents.Failed = [];
    }
    else if (output["BatchResultErrorEntry"] !== undefined) {
        contents.Failed = de_BatchResultErrorEntryList((0, smithy_client_1.getArrayIfSingleItem)(output["BatchResultErrorEntry"]), context);
    }
    return contents;
};
const de_ChangeMessageVisibilityBatchResultEntry = (output, context) => {
    const contents = {};
    if (output["Id"] !== undefined) {
        contents.Id = (0, smithy_client_1.expectString)(output["Id"]);
    }
    return contents;
};
const de_ChangeMessageVisibilityBatchResultEntryList = (output, context) => {
    return (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_ChangeMessageVisibilityBatchResultEntry(entry, context);
    });
};
const de_CreateQueueResult = (output, context) => {
    const contents = {};
    if (output["QueueUrl"] !== undefined) {
        contents.QueueUrl = (0, smithy_client_1.expectString)(output["QueueUrl"]);
    }
    return contents;
};
const de_DeleteMessageBatchResult = (output, context) => {
    const contents = {};
    if (output.DeleteMessageBatchResultEntry === "") {
        contents.Successful = [];
    }
    else if (output["DeleteMessageBatchResultEntry"] !== undefined) {
        contents.Successful = de_DeleteMessageBatchResultEntryList((0, smithy_client_1.getArrayIfSingleItem)(output["DeleteMessageBatchResultEntry"]), context);
    }
    if (output.BatchResultErrorEntry === "") {
        contents.Failed = [];
    }
    else if (output["BatchResultErrorEntry"] !== undefined) {
        contents.Failed = de_BatchResultErrorEntryList((0, smithy_client_1.getArrayIfSingleItem)(output["BatchResultErrorEntry"]), context);
    }
    return contents;
};
const de_DeleteMessageBatchResultEntry = (output, context) => {
    const contents = {};
    if (output["Id"] !== undefined) {
        contents.Id = (0, smithy_client_1.expectString)(output["Id"]);
    }
    return contents;
};
const de_DeleteMessageBatchResultEntryList = (output, context) => {
    return (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_DeleteMessageBatchResultEntry(entry, context);
    });
};
const de_EmptyBatchRequest = (output, context) => {
    const contents = {};
    return contents;
};
const de_GetQueueAttributesResult = (output, context) => {
    const contents = {};
    if (output.Attribute === "") {
        contents.Attributes = {};
    }
    else if (output["Attribute"] !== undefined) {
        contents.Attributes = de_QueueAttributeMap((0, smithy_client_1.getArrayIfSingleItem)(output["Attribute"]), context);
    }
    return contents;
};
const de_GetQueueUrlResult = (output, context) => {
    const contents = {};
    if (output["QueueUrl"] !== undefined) {
        contents.QueueUrl = (0, smithy_client_1.expectString)(output["QueueUrl"]);
    }
    return contents;
};
const de_InvalidAttributeName = (output, context) => {
    const contents = {};
    return contents;
};
const de_InvalidBatchEntryId = (output, context) => {
    const contents = {};
    return contents;
};
const de_InvalidIdFormat = (output, context) => {
    const contents = {};
    return contents;
};
const de_InvalidMessageContents = (output, context) => {
    const contents = {};
    return contents;
};
const de_ListDeadLetterSourceQueuesResult = (output, context) => {
    const contents = {};
    if (output.QueueUrl === "") {
        contents.queueUrls = [];
    }
    else if (output["QueueUrl"] !== undefined) {
        contents.queueUrls = de_QueueUrlList((0, smithy_client_1.getArrayIfSingleItem)(output["QueueUrl"]), context);
    }
    if (output["NextToken"] !== undefined) {
        contents.NextToken = (0, smithy_client_1.expectString)(output["NextToken"]);
    }
    return contents;
};
const de_ListMessageMoveTasksResult = (output, context) => {
    const contents = {};
    if (output.ListMessageMoveTasksResultEntry === "") {
        contents.Results = [];
    }
    else if (output["ListMessageMoveTasksResultEntry"] !== undefined) {
        contents.Results = de_ListMessageMoveTasksResultEntryList((0, smithy_client_1.getArrayIfSingleItem)(output["ListMessageMoveTasksResultEntry"]), context);
    }
    return contents;
};
const de_ListMessageMoveTasksResultEntry = (output, context) => {
    const contents = {};
    if (output["TaskHandle"] !== undefined) {
        contents.TaskHandle = (0, smithy_client_1.expectString)(output["TaskHandle"]);
    }
    if (output["Status"] !== undefined) {
        contents.Status = (0, smithy_client_1.expectString)(output["Status"]);
    }
    if (output["SourceArn"] !== undefined) {
        contents.SourceArn = (0, smithy_client_1.expectString)(output["SourceArn"]);
    }
    if (output["DestinationArn"] !== undefined) {
        contents.DestinationArn = (0, smithy_client_1.expectString)(output["DestinationArn"]);
    }
    if (output["MaxNumberOfMessagesPerSecond"] !== undefined) {
        contents.MaxNumberOfMessagesPerSecond = (0, smithy_client_1.strictParseInt32)(output["MaxNumberOfMessagesPerSecond"]);
    }
    if (output["ApproximateNumberOfMessagesMoved"] !== undefined) {
        contents.ApproximateNumberOfMessagesMoved = (0, smithy_client_1.strictParseLong)(output["ApproximateNumberOfMessagesMoved"]);
    }
    if (output["ApproximateNumberOfMessagesToMove"] !== undefined) {
        contents.ApproximateNumberOfMessagesToMove = (0, smithy_client_1.strictParseLong)(output["ApproximateNumberOfMessagesToMove"]);
    }
    if (output["FailureReason"] !== undefined) {
        contents.FailureReason = (0, smithy_client_1.expectString)(output["FailureReason"]);
    }
    if (output["StartedTimestamp"] !== undefined) {
        contents.StartedTimestamp = (0, smithy_client_1.strictParseLong)(output["StartedTimestamp"]);
    }
    return contents;
};
const de_ListMessageMoveTasksResultEntryList = (output, context) => {
    return (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_ListMessageMoveTasksResultEntry(entry, context);
    });
};
const de_ListQueuesResult = (output, context) => {
    const contents = {};
    if (output["NextToken"] !== undefined) {
        contents.NextToken = (0, smithy_client_1.expectString)(output["NextToken"]);
    }
    if (output.QueueUrl === "") {
        contents.QueueUrls = [];
    }
    else if (output["QueueUrl"] !== undefined) {
        contents.QueueUrls = de_QueueUrlList((0, smithy_client_1.getArrayIfSingleItem)(output["QueueUrl"]), context);
    }
    return contents;
};
const de_ListQueueTagsResult = (output, context) => {
    const contents = {};
    if (output.Tag === "") {
        contents.Tags = {};
    }
    else if (output["Tag"] !== undefined) {
        contents.Tags = de_TagMap((0, smithy_client_1.getArrayIfSingleItem)(output["Tag"]), context);
    }
    return contents;
};
const de_Message = (output, context) => {
    const contents = {};
    if (output["MessageId"] !== undefined) {
        contents.MessageId = (0, smithy_client_1.expectString)(output["MessageId"]);
    }
    if (output["ReceiptHandle"] !== undefined) {
        contents.ReceiptHandle = (0, smithy_client_1.expectString)(output["ReceiptHandle"]);
    }
    if (output["MD5OfBody"] !== undefined) {
        contents.MD5OfBody = (0, smithy_client_1.expectString)(output["MD5OfBody"]);
    }
    if (output["Body"] !== undefined) {
        contents.Body = (0, smithy_client_1.expectString)(output["Body"]);
    }
    if (output.Attribute === "") {
        contents.Attributes = {};
    }
    else if (output["Attribute"] !== undefined) {
        contents.Attributes = de_MessageSystemAttributeMap((0, smithy_client_1.getArrayIfSingleItem)(output["Attribute"]), context);
    }
    if (output["MD5OfMessageAttributes"] !== undefined) {
        contents.MD5OfMessageAttributes = (0, smithy_client_1.expectString)(output["MD5OfMessageAttributes"]);
    }
    if (output.MessageAttribute === "") {
        contents.MessageAttributes = {};
    }
    else if (output["MessageAttribute"] !== undefined) {
        contents.MessageAttributes = de_MessageBodyAttributeMap((0, smithy_client_1.getArrayIfSingleItem)(output["MessageAttribute"]), context);
    }
    return contents;
};
const de_MessageAttributeValue = (output, context) => {
    const contents = {};
    if (output["StringValue"] !== undefined) {
        contents.StringValue = (0, smithy_client_1.expectString)(output["StringValue"]);
    }
    if (output["BinaryValue"] !== undefined) {
        contents.BinaryValue = context.base64Decoder(output["BinaryValue"]);
    }
    if (output.StringListValue === "") {
        contents.StringListValues = [];
    }
    else if (output["StringListValue"] !== undefined) {
        contents.StringListValues = de_StringList((0, smithy_client_1.getArrayIfSingleItem)(output["StringListValue"]), context);
    }
    if (output.BinaryListValue === "") {
        contents.BinaryListValues = [];
    }
    else if (output["BinaryListValue"] !== undefined) {
        contents.BinaryListValues = de_BinaryList((0, smithy_client_1.getArrayIfSingleItem)(output["BinaryListValue"]), context);
    }
    if (output["DataType"] !== undefined) {
        contents.DataType = (0, smithy_client_1.expectString)(output["DataType"]);
    }
    return contents;
};
const de_MessageBodyAttributeMap = (output, context) => {
    return output.reduce((acc, pair) => {
        if (pair["Value"] === null) {
            return acc;
        }
        acc[pair["Name"]] = de_MessageAttributeValue(pair["Value"], context);
        return acc;
    }, {});
};
const de_MessageList = (output, context) => {
    return (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_Message(entry, context);
    });
};
const de_MessageNotInflight = (output, context) => {
    const contents = {};
    return contents;
};
const de_MessageSystemAttributeMap = (output, context) => {
    return output.reduce((acc, pair) => {
        if (pair["Value"] === null) {
            return acc;
        }
        acc[pair["Name"]] = (0, smithy_client_1.expectString)(pair["Value"]);
        return acc;
    }, {});
};
const de_OverLimit = (output, context) => {
    const contents = {};
    return contents;
};
const de_PurgeQueueInProgress = (output, context) => {
    const contents = {};
    return contents;
};
const de_QueueAttributeMap = (output, context) => {
    return output.reduce((acc, pair) => {
        if (pair["Value"] === null) {
            return acc;
        }
        acc[pair["Name"]] = (0, smithy_client_1.expectString)(pair["Value"]);
        return acc;
    }, {});
};
const de_QueueDeletedRecently = (output, context) => {
    const contents = {};
    return contents;
};
const de_QueueDoesNotExist = (output, context) => {
    const contents = {};
    return contents;
};
const de_QueueNameExists = (output, context) => {
    const contents = {};
    return contents;
};
const de_QueueUrlList = (output, context) => {
    return (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return (0, smithy_client_1.expectString)(entry);
    });
};
const de_ReceiptHandleIsInvalid = (output, context) => {
    const contents = {};
    return contents;
};
const de_ReceiveMessageResult = (output, context) => {
    const contents = {};
    if (output.Message === "") {
        contents.Messages = [];
    }
    else if (output["Message"] !== undefined) {
        contents.Messages = de_MessageList((0, smithy_client_1.getArrayIfSingleItem)(output["Message"]), context);
    }
    return contents;
};
const de_ResourceNotFoundException = (output, context) => {
    const contents = {};
    return contents;
};
const de_SendMessageBatchResult = (output, context) => {
    const contents = {};
    if (output.SendMessageBatchResultEntry === "") {
        contents.Successful = [];
    }
    else if (output["SendMessageBatchResultEntry"] !== undefined) {
        contents.Successful = de_SendMessageBatchResultEntryList((0, smithy_client_1.getArrayIfSingleItem)(output["SendMessageBatchResultEntry"]), context);
    }
    if (output.BatchResultErrorEntry === "") {
        contents.Failed = [];
    }
    else if (output["BatchResultErrorEntry"] !== undefined) {
        contents.Failed = de_BatchResultErrorEntryList((0, smithy_client_1.getArrayIfSingleItem)(output["BatchResultErrorEntry"]), context);
    }
    return contents;
};
const de_SendMessageBatchResultEntry = (output, context) => {
    const contents = {};
    if (output["Id"] !== undefined) {
        contents.Id = (0, smithy_client_1.expectString)(output["Id"]);
    }
    if (output["MessageId"] !== undefined) {
        contents.MessageId = (0, smithy_client_1.expectString)(output["MessageId"]);
    }
    if (output["MD5OfMessageBody"] !== undefined) {
        contents.MD5OfMessageBody = (0, smithy_client_1.expectString)(output["MD5OfMessageBody"]);
    }
    if (output["MD5OfMessageAttributes"] !== undefined) {
        contents.MD5OfMessageAttributes = (0, smithy_client_1.expectString)(output["MD5OfMessageAttributes"]);
    }
    if (output["MD5OfMessageSystemAttributes"] !== undefined) {
        contents.MD5OfMessageSystemAttributes = (0, smithy_client_1.expectString)(output["MD5OfMessageSystemAttributes"]);
    }
    if (output["SequenceNumber"] !== undefined) {
        contents.SequenceNumber = (0, smithy_client_1.expectString)(output["SequenceNumber"]);
    }
    return contents;
};
const de_SendMessageBatchResultEntryList = (output, context) => {
    return (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_SendMessageBatchResultEntry(entry, context);
    });
};
const de_SendMessageResult = (output, context) => {
    const contents = {};
    if (output["MD5OfMessageBody"] !== undefined) {
        contents.MD5OfMessageBody = (0, smithy_client_1.expectString)(output["MD5OfMessageBody"]);
    }
    if (output["MD5OfMessageAttributes"] !== undefined) {
        contents.MD5OfMessageAttributes = (0, smithy_client_1.expectString)(output["MD5OfMessageAttributes"]);
    }
    if (output["MD5OfMessageSystemAttributes"] !== undefined) {
        contents.MD5OfMessageSystemAttributes = (0, smithy_client_1.expectString)(output["MD5OfMessageSystemAttributes"]);
    }
    if (output["MessageId"] !== undefined) {
        contents.MessageId = (0, smithy_client_1.expectString)(output["MessageId"]);
    }
    if (output["SequenceNumber"] !== undefined) {
        contents.SequenceNumber = (0, smithy_client_1.expectString)(output["SequenceNumber"]);
    }
    return contents;
};
const de_StartMessageMoveTaskResult = (output, context) => {
    const contents = {};
    if (output["TaskHandle"] !== undefined) {
        contents.TaskHandle = (0, smithy_client_1.expectString)(output["TaskHandle"]);
    }
    return contents;
};
const de_StringList = (output, context) => {
    return (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return (0, smithy_client_1.expectString)(entry);
    });
};
const de_TagMap = (output, context) => {
    return output.reduce((acc, pair) => {
        if (pair["Value"] === null) {
            return acc;
        }
        acc[pair["Key"]] = (0, smithy_client_1.expectString)(pair["Value"]);
        return acc;
    }, {});
};
const de_TooManyEntriesInBatchRequest = (output, context) => {
    const contents = {};
    return contents;
};
const de_UnsupportedOperation = (output, context) => {
    const contents = {};
    return contents;
};
const deserializeMetadata = (output) => ({
    httpStatusCode: output.statusCode,
    requestId: output.headers["x-amzn-requestid"] ?? output.headers["x-amzn-request-id"] ?? output.headers["x-amz-request-id"],
    extendedRequestId: output.headers["x-amz-id-2"],
    cfId: output.headers["x-amz-cf-id"],
});
const collectBodyString = (streamBody, context) => (0, smithy_client_1.collectBody)(streamBody, context).then((body) => context.utf8Encoder(body));
const throwDefaultError = (0, smithy_client_1.withBaseException)(SQSServiceException_1.SQSServiceException);
const buildHttpRpcRequest = async (context, headers, path, resolvedHostname, body) => {
    const { hostname, protocol = "https", port, path: basePath } = await context.endpoint();
    const contents = {
        protocol,
        hostname,
        port,
        method: "POST",
        path: basePath.endsWith("/") ? basePath.slice(0, -1) + path : basePath + path,
        headers,
    };
    if (resolvedHostname !== undefined) {
        contents.hostname = resolvedHostname;
    }
    if (body !== undefined) {
        contents.body = body;
    }
    return new protocol_http_1.HttpRequest(contents);
};
const SHARED_HEADERS = {
    "content-type": "application/x-www-form-urlencoded",
};
const parseBody = (streamBody, context) => collectBodyString(streamBody, context).then((encoded) => {
    if (encoded.length) {
        const parser = new fast_xml_parser_1.XMLParser({
            attributeNamePrefix: "",
            htmlEntities: true,
            ignoreAttributes: false,
            ignoreDeclaration: true,
            parseTagValue: false,
            trimValues: false,
            tagValueProcessor: (_, val) => (val.trim() === "" && val.includes("\n") ? "" : undefined),
        });
        parser.addEntity("#xD", "\r");
        parser.addEntity("#10", "\n");
        const parsedObj = parser.parse(encoded);
        const textNodeName = "#text";
        const key = Object.keys(parsedObj)[0];
        const parsedObjToReturn = parsedObj[key];
        if (parsedObjToReturn[textNodeName]) {
            parsedObjToReturn[key] = parsedObjToReturn[textNodeName];
            delete parsedObjToReturn[textNodeName];
        }
        return (0, smithy_client_1.getValueFromTextNode)(parsedObjToReturn);
    }
    return {};
});
const parseErrorBody = async (errorBody, context) => {
    const value = await parseBody(errorBody, context);
    if (value.Error) {
        value.Error.message = value.Error.message ?? value.Error.Message;
    }
    return value;
};
const buildFormUrlencodedString = (formEntries) => Object.entries(formEntries)
    .map(([key, value]) => (0, smithy_client_1.extendedEncodeURIComponent)(key) + "=" + (0, smithy_client_1.extendedEncodeURIComponent)(value))
    .join("&");
const loadQueryErrorCode = (output, data) => {
    if (data.Error?.Code !== undefined) {
        return data.Error.Code;
    }
    if (output.statusCode == 404) {
        return "NotFound";
    }
};
