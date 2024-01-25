"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SQS = void 0;
const smithy_client_1 = require("@smithy/smithy-client");
const AddPermissionCommand_1 = require("./commands/AddPermissionCommand");
const CancelMessageMoveTaskCommand_1 = require("./commands/CancelMessageMoveTaskCommand");
const ChangeMessageVisibilityBatchCommand_1 = require("./commands/ChangeMessageVisibilityBatchCommand");
const ChangeMessageVisibilityCommand_1 = require("./commands/ChangeMessageVisibilityCommand");
const CreateQueueCommand_1 = require("./commands/CreateQueueCommand");
const DeleteMessageBatchCommand_1 = require("./commands/DeleteMessageBatchCommand");
const DeleteMessageCommand_1 = require("./commands/DeleteMessageCommand");
const DeleteQueueCommand_1 = require("./commands/DeleteQueueCommand");
const GetQueueAttributesCommand_1 = require("./commands/GetQueueAttributesCommand");
const GetQueueUrlCommand_1 = require("./commands/GetQueueUrlCommand");
const ListDeadLetterSourceQueuesCommand_1 = require("./commands/ListDeadLetterSourceQueuesCommand");
const ListMessageMoveTasksCommand_1 = require("./commands/ListMessageMoveTasksCommand");
const ListQueuesCommand_1 = require("./commands/ListQueuesCommand");
const ListQueueTagsCommand_1 = require("./commands/ListQueueTagsCommand");
const PurgeQueueCommand_1 = require("./commands/PurgeQueueCommand");
const ReceiveMessageCommand_1 = require("./commands/ReceiveMessageCommand");
const RemovePermissionCommand_1 = require("./commands/RemovePermissionCommand");
const SendMessageBatchCommand_1 = require("./commands/SendMessageBatchCommand");
const SendMessageCommand_1 = require("./commands/SendMessageCommand");
const SetQueueAttributesCommand_1 = require("./commands/SetQueueAttributesCommand");
const StartMessageMoveTaskCommand_1 = require("./commands/StartMessageMoveTaskCommand");
const TagQueueCommand_1 = require("./commands/TagQueueCommand");
const UntagQueueCommand_1 = require("./commands/UntagQueueCommand");
const SQSClient_1 = require("./SQSClient");
const commands = {
    AddPermissionCommand: AddPermissionCommand_1.AddPermissionCommand,
    CancelMessageMoveTaskCommand: CancelMessageMoveTaskCommand_1.CancelMessageMoveTaskCommand,
    ChangeMessageVisibilityCommand: ChangeMessageVisibilityCommand_1.ChangeMessageVisibilityCommand,
    ChangeMessageVisibilityBatchCommand: ChangeMessageVisibilityBatchCommand_1.ChangeMessageVisibilityBatchCommand,
    CreateQueueCommand: CreateQueueCommand_1.CreateQueueCommand,
    DeleteMessageCommand: DeleteMessageCommand_1.DeleteMessageCommand,
    DeleteMessageBatchCommand: DeleteMessageBatchCommand_1.DeleteMessageBatchCommand,
    DeleteQueueCommand: DeleteQueueCommand_1.DeleteQueueCommand,
    GetQueueAttributesCommand: GetQueueAttributesCommand_1.GetQueueAttributesCommand,
    GetQueueUrlCommand: GetQueueUrlCommand_1.GetQueueUrlCommand,
    ListDeadLetterSourceQueuesCommand: ListDeadLetterSourceQueuesCommand_1.ListDeadLetterSourceQueuesCommand,
    ListMessageMoveTasksCommand: ListMessageMoveTasksCommand_1.ListMessageMoveTasksCommand,
    ListQueuesCommand: ListQueuesCommand_1.ListQueuesCommand,
    ListQueueTagsCommand: ListQueueTagsCommand_1.ListQueueTagsCommand,
    PurgeQueueCommand: PurgeQueueCommand_1.PurgeQueueCommand,
    ReceiveMessageCommand: ReceiveMessageCommand_1.ReceiveMessageCommand,
    RemovePermissionCommand: RemovePermissionCommand_1.RemovePermissionCommand,
    SendMessageCommand: SendMessageCommand_1.SendMessageCommand,
    SendMessageBatchCommand: SendMessageBatchCommand_1.SendMessageBatchCommand,
    SetQueueAttributesCommand: SetQueueAttributesCommand_1.SetQueueAttributesCommand,
    StartMessageMoveTaskCommand: StartMessageMoveTaskCommand_1.StartMessageMoveTaskCommand,
    TagQueueCommand: TagQueueCommand_1.TagQueueCommand,
    UntagQueueCommand: UntagQueueCommand_1.UntagQueueCommand,
};
class SQS extends SQSClient_1.SQSClient {
}
exports.SQS = SQS;
(0, smithy_client_1.createAggregatedClient)(commands, SQS);
