import { HttpRequest as __HttpRequest, HttpResponse as __HttpResponse } from "@smithy/protocol-http";
import { SerdeContext as __SerdeContext } from "@smithy/types";
import { AddPermissionCommandInput, AddPermissionCommandOutput } from "../commands/AddPermissionCommand";
import { CancelMessageMoveTaskCommandInput, CancelMessageMoveTaskCommandOutput } from "../commands/CancelMessageMoveTaskCommand";
import { ChangeMessageVisibilityBatchCommandInput, ChangeMessageVisibilityBatchCommandOutput } from "../commands/ChangeMessageVisibilityBatchCommand";
import { ChangeMessageVisibilityCommandInput, ChangeMessageVisibilityCommandOutput } from "../commands/ChangeMessageVisibilityCommand";
import { CreateQueueCommandInput, CreateQueueCommandOutput } from "../commands/CreateQueueCommand";
import { DeleteMessageBatchCommandInput, DeleteMessageBatchCommandOutput } from "../commands/DeleteMessageBatchCommand";
import { DeleteMessageCommandInput, DeleteMessageCommandOutput } from "../commands/DeleteMessageCommand";
import { DeleteQueueCommandInput, DeleteQueueCommandOutput } from "../commands/DeleteQueueCommand";
import { GetQueueAttributesCommandInput, GetQueueAttributesCommandOutput } from "../commands/GetQueueAttributesCommand";
import { GetQueueUrlCommandInput, GetQueueUrlCommandOutput } from "../commands/GetQueueUrlCommand";
import { ListDeadLetterSourceQueuesCommandInput, ListDeadLetterSourceQueuesCommandOutput } from "../commands/ListDeadLetterSourceQueuesCommand";
import { ListMessageMoveTasksCommandInput, ListMessageMoveTasksCommandOutput } from "../commands/ListMessageMoveTasksCommand";
import { ListQueuesCommandInput, ListQueuesCommandOutput } from "../commands/ListQueuesCommand";
import { ListQueueTagsCommandInput, ListQueueTagsCommandOutput } from "../commands/ListQueueTagsCommand";
import { PurgeQueueCommandInput, PurgeQueueCommandOutput } from "../commands/PurgeQueueCommand";
import { ReceiveMessageCommandInput, ReceiveMessageCommandOutput } from "../commands/ReceiveMessageCommand";
import { RemovePermissionCommandInput, RemovePermissionCommandOutput } from "../commands/RemovePermissionCommand";
import { SendMessageBatchCommandInput, SendMessageBatchCommandOutput } from "../commands/SendMessageBatchCommand";
import { SendMessageCommandInput, SendMessageCommandOutput } from "../commands/SendMessageCommand";
import { SetQueueAttributesCommandInput, SetQueueAttributesCommandOutput } from "../commands/SetQueueAttributesCommand";
import { StartMessageMoveTaskCommandInput, StartMessageMoveTaskCommandOutput } from "../commands/StartMessageMoveTaskCommand";
import { TagQueueCommandInput, TagQueueCommandOutput } from "../commands/TagQueueCommand";
import { UntagQueueCommandInput, UntagQueueCommandOutput } from "../commands/UntagQueueCommand";
/**
 * serializeAws_queryAddPermissionCommand
 */
export declare const se_AddPermissionCommand: (input: AddPermissionCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_queryCancelMessageMoveTaskCommand
 */
export declare const se_CancelMessageMoveTaskCommand: (input: CancelMessageMoveTaskCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_queryChangeMessageVisibilityCommand
 */
export declare const se_ChangeMessageVisibilityCommand: (input: ChangeMessageVisibilityCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_queryChangeMessageVisibilityBatchCommand
 */
export declare const se_ChangeMessageVisibilityBatchCommand: (input: ChangeMessageVisibilityBatchCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_queryCreateQueueCommand
 */
export declare const se_CreateQueueCommand: (input: CreateQueueCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_queryDeleteMessageCommand
 */
export declare const se_DeleteMessageCommand: (input: DeleteMessageCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_queryDeleteMessageBatchCommand
 */
export declare const se_DeleteMessageBatchCommand: (input: DeleteMessageBatchCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_queryDeleteQueueCommand
 */
export declare const se_DeleteQueueCommand: (input: DeleteQueueCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_queryGetQueueAttributesCommand
 */
export declare const se_GetQueueAttributesCommand: (input: GetQueueAttributesCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_queryGetQueueUrlCommand
 */
export declare const se_GetQueueUrlCommand: (input: GetQueueUrlCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_queryListDeadLetterSourceQueuesCommand
 */
export declare const se_ListDeadLetterSourceQueuesCommand: (input: ListDeadLetterSourceQueuesCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_queryListMessageMoveTasksCommand
 */
export declare const se_ListMessageMoveTasksCommand: (input: ListMessageMoveTasksCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_queryListQueuesCommand
 */
export declare const se_ListQueuesCommand: (input: ListQueuesCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_queryListQueueTagsCommand
 */
export declare const se_ListQueueTagsCommand: (input: ListQueueTagsCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_queryPurgeQueueCommand
 */
export declare const se_PurgeQueueCommand: (input: PurgeQueueCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_queryReceiveMessageCommand
 */
export declare const se_ReceiveMessageCommand: (input: ReceiveMessageCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_queryRemovePermissionCommand
 */
export declare const se_RemovePermissionCommand: (input: RemovePermissionCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_querySendMessageCommand
 */
export declare const se_SendMessageCommand: (input: SendMessageCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_querySendMessageBatchCommand
 */
export declare const se_SendMessageBatchCommand: (input: SendMessageBatchCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_querySetQueueAttributesCommand
 */
export declare const se_SetQueueAttributesCommand: (input: SetQueueAttributesCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_queryStartMessageMoveTaskCommand
 */
export declare const se_StartMessageMoveTaskCommand: (input: StartMessageMoveTaskCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_queryTagQueueCommand
 */
export declare const se_TagQueueCommand: (input: TagQueueCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * serializeAws_queryUntagQueueCommand
 */
export declare const se_UntagQueueCommand: (input: UntagQueueCommandInput, context: __SerdeContext) => Promise<__HttpRequest>;
/**
 * deserializeAws_queryAddPermissionCommand
 */
export declare const de_AddPermissionCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<AddPermissionCommandOutput>;
/**
 * deserializeAws_queryCancelMessageMoveTaskCommand
 */
export declare const de_CancelMessageMoveTaskCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<CancelMessageMoveTaskCommandOutput>;
/**
 * deserializeAws_queryChangeMessageVisibilityCommand
 */
export declare const de_ChangeMessageVisibilityCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<ChangeMessageVisibilityCommandOutput>;
/**
 * deserializeAws_queryChangeMessageVisibilityBatchCommand
 */
export declare const de_ChangeMessageVisibilityBatchCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<ChangeMessageVisibilityBatchCommandOutput>;
/**
 * deserializeAws_queryCreateQueueCommand
 */
export declare const de_CreateQueueCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<CreateQueueCommandOutput>;
/**
 * deserializeAws_queryDeleteMessageCommand
 */
export declare const de_DeleteMessageCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<DeleteMessageCommandOutput>;
/**
 * deserializeAws_queryDeleteMessageBatchCommand
 */
export declare const de_DeleteMessageBatchCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<DeleteMessageBatchCommandOutput>;
/**
 * deserializeAws_queryDeleteQueueCommand
 */
export declare const de_DeleteQueueCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<DeleteQueueCommandOutput>;
/**
 * deserializeAws_queryGetQueueAttributesCommand
 */
export declare const de_GetQueueAttributesCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<GetQueueAttributesCommandOutput>;
/**
 * deserializeAws_queryGetQueueUrlCommand
 */
export declare const de_GetQueueUrlCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<GetQueueUrlCommandOutput>;
/**
 * deserializeAws_queryListDeadLetterSourceQueuesCommand
 */
export declare const de_ListDeadLetterSourceQueuesCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<ListDeadLetterSourceQueuesCommandOutput>;
/**
 * deserializeAws_queryListMessageMoveTasksCommand
 */
export declare const de_ListMessageMoveTasksCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<ListMessageMoveTasksCommandOutput>;
/**
 * deserializeAws_queryListQueuesCommand
 */
export declare const de_ListQueuesCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<ListQueuesCommandOutput>;
/**
 * deserializeAws_queryListQueueTagsCommand
 */
export declare const de_ListQueueTagsCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<ListQueueTagsCommandOutput>;
/**
 * deserializeAws_queryPurgeQueueCommand
 */
export declare const de_PurgeQueueCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<PurgeQueueCommandOutput>;
/**
 * deserializeAws_queryReceiveMessageCommand
 */
export declare const de_ReceiveMessageCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<ReceiveMessageCommandOutput>;
/**
 * deserializeAws_queryRemovePermissionCommand
 */
export declare const de_RemovePermissionCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<RemovePermissionCommandOutput>;
/**
 * deserializeAws_querySendMessageCommand
 */
export declare const de_SendMessageCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<SendMessageCommandOutput>;
/**
 * deserializeAws_querySendMessageBatchCommand
 */
export declare const de_SendMessageBatchCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<SendMessageBatchCommandOutput>;
/**
 * deserializeAws_querySetQueueAttributesCommand
 */
export declare const de_SetQueueAttributesCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<SetQueueAttributesCommandOutput>;
/**
 * deserializeAws_queryStartMessageMoveTaskCommand
 */
export declare const de_StartMessageMoveTaskCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<StartMessageMoveTaskCommandOutput>;
/**
 * deserializeAws_queryTagQueueCommand
 */
export declare const de_TagQueueCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<TagQueueCommandOutput>;
/**
 * deserializeAws_queryUntagQueueCommand
 */
export declare const de_UntagQueueCommand: (output: __HttpResponse, context: __SerdeContext) => Promise<UntagQueueCommandOutput>;
