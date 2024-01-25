import { ExceptionOptionType as __ExceptionOptionType } from "@smithy/smithy-client";
import { SQSServiceException as __BaseException } from "./SQSServiceException";
export interface AddPermissionRequest {
  QueueUrl: string | undefined;
  Label: string | undefined;
  AWSAccountIds: string[] | undefined;
  Actions: string[] | undefined;
}
export declare class OverLimit extends __BaseException {
  readonly name: "OverLimit";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<OverLimit, __BaseException>);
}
export interface CancelMessageMoveTaskRequest {
  TaskHandle: string | undefined;
}
export interface CancelMessageMoveTaskResult {
  ApproximateNumberOfMessagesMoved?: number;
}
export declare class ResourceNotFoundException extends __BaseException {
  readonly name: "ResourceNotFoundException";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<ResourceNotFoundException, __BaseException>
  );
}
export declare class UnsupportedOperation extends __BaseException {
  readonly name: "UnsupportedOperation";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<UnsupportedOperation, __BaseException>
  );
}
export interface ChangeMessageVisibilityRequest {
  QueueUrl: string | undefined;
  ReceiptHandle: string | undefined;
  VisibilityTimeout: number | undefined;
}
export declare class MessageNotInflight extends __BaseException {
  readonly name: "MessageNotInflight";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<MessageNotInflight, __BaseException>);
}
export declare class ReceiptHandleIsInvalid extends __BaseException {
  readonly name: "ReceiptHandleIsInvalid";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<ReceiptHandleIsInvalid, __BaseException>
  );
}
export declare class BatchEntryIdsNotDistinct extends __BaseException {
  readonly name: "BatchEntryIdsNotDistinct";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<BatchEntryIdsNotDistinct, __BaseException>
  );
}
export interface ChangeMessageVisibilityBatchRequestEntry {
  Id: string | undefined;
  ReceiptHandle: string | undefined;
  VisibilityTimeout?: number;
}
export interface ChangeMessageVisibilityBatchRequest {
  QueueUrl: string | undefined;
  Entries: ChangeMessageVisibilityBatchRequestEntry[] | undefined;
}
export interface BatchResultErrorEntry {
  Id: string | undefined;
  SenderFault: boolean | undefined;
  Code: string | undefined;
  Message?: string;
}
export interface ChangeMessageVisibilityBatchResultEntry {
  Id: string | undefined;
}
export interface ChangeMessageVisibilityBatchResult {
  Successful: ChangeMessageVisibilityBatchResultEntry[] | undefined;
  Failed: BatchResultErrorEntry[] | undefined;
}
export declare class EmptyBatchRequest extends __BaseException {
  readonly name: "EmptyBatchRequest";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<EmptyBatchRequest, __BaseException>);
}
export declare class InvalidBatchEntryId extends __BaseException {
  readonly name: "InvalidBatchEntryId";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<InvalidBatchEntryId, __BaseException>
  );
}
export declare class TooManyEntriesInBatchRequest extends __BaseException {
  readonly name: "TooManyEntriesInBatchRequest";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<TooManyEntriesInBatchRequest, __BaseException>
  );
}
export declare const QueueAttributeName: {
  readonly All: "All";
  readonly ApproximateNumberOfMessages: "ApproximateNumberOfMessages";
  readonly ApproximateNumberOfMessagesDelayed: "ApproximateNumberOfMessagesDelayed";
  readonly ApproximateNumberOfMessagesNotVisible: "ApproximateNumberOfMessagesNotVisible";
  readonly ContentBasedDeduplication: "ContentBasedDeduplication";
  readonly CreatedTimestamp: "CreatedTimestamp";
  readonly DeduplicationScope: "DeduplicationScope";
  readonly DelaySeconds: "DelaySeconds";
  readonly FifoQueue: "FifoQueue";
  readonly FifoThroughputLimit: "FifoThroughputLimit";
  readonly KmsDataKeyReusePeriodSeconds: "KmsDataKeyReusePeriodSeconds";
  readonly KmsMasterKeyId: "KmsMasterKeyId";
  readonly LastModifiedTimestamp: "LastModifiedTimestamp";
  readonly MaximumMessageSize: "MaximumMessageSize";
  readonly MessageRetentionPeriod: "MessageRetentionPeriod";
  readonly Policy: "Policy";
  readonly QueueArn: "QueueArn";
  readonly ReceiveMessageWaitTimeSeconds: "ReceiveMessageWaitTimeSeconds";
  readonly RedriveAllowPolicy: "RedriveAllowPolicy";
  readonly RedrivePolicy: "RedrivePolicy";
  readonly SqsManagedSseEnabled: "SqsManagedSseEnabled";
  readonly VisibilityTimeout: "VisibilityTimeout";
};
export type QueueAttributeName =
  (typeof QueueAttributeName)[keyof typeof QueueAttributeName];
export interface CreateQueueRequest {
  QueueName: string | undefined;
  tags?: Record<string, string>;
  Attributes?: Record<string, string>;
}
export interface CreateQueueResult {
  QueueUrl?: string;
}
export declare class QueueDeletedRecently extends __BaseException {
  readonly name: "QueueDeletedRecently";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<QueueDeletedRecently, __BaseException>
  );
}
export declare class QueueNameExists extends __BaseException {
  readonly name: "QueueNameExists";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<QueueNameExists, __BaseException>);
}
export interface DeleteMessageRequest {
  QueueUrl: string | undefined;
  ReceiptHandle: string | undefined;
}
export declare class InvalidIdFormat extends __BaseException {
  readonly name: "InvalidIdFormat";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<InvalidIdFormat, __BaseException>);
}
export interface DeleteMessageBatchRequestEntry {
  Id: string | undefined;
  ReceiptHandle: string | undefined;
}
export interface DeleteMessageBatchRequest {
  QueueUrl: string | undefined;
  Entries: DeleteMessageBatchRequestEntry[] | undefined;
}
export interface DeleteMessageBatchResultEntry {
  Id: string | undefined;
}
export interface DeleteMessageBatchResult {
  Successful: DeleteMessageBatchResultEntry[] | undefined;
  Failed: BatchResultErrorEntry[] | undefined;
}
export interface DeleteQueueRequest {
  QueueUrl: string | undefined;
}
export interface GetQueueAttributesRequest {
  QueueUrl: string | undefined;
  AttributeNames?: (QueueAttributeName | string)[];
}
export interface GetQueueAttributesResult {
  Attributes?: Record<string, string>;
}
export declare class InvalidAttributeName extends __BaseException {
  readonly name: "InvalidAttributeName";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<InvalidAttributeName, __BaseException>
  );
}
export interface GetQueueUrlRequest {
  QueueName: string | undefined;
  QueueOwnerAWSAccountId?: string;
}
export interface GetQueueUrlResult {
  QueueUrl?: string;
}
export declare class QueueDoesNotExist extends __BaseException {
  readonly name: "QueueDoesNotExist";
  readonly $fault: "client";
  constructor(opts: __ExceptionOptionType<QueueDoesNotExist, __BaseException>);
}
export interface ListDeadLetterSourceQueuesRequest {
  QueueUrl: string | undefined;
  NextToken?: string;
  MaxResults?: number;
}
export interface ListDeadLetterSourceQueuesResult {
  queueUrls: string[] | undefined;
  NextToken?: string;
}
export interface ListMessageMoveTasksRequest {
  SourceArn: string | undefined;
  MaxResults?: number;
}
export interface ListMessageMoveTasksResultEntry {
  TaskHandle?: string;
  Status?: string;
  SourceArn?: string;
  DestinationArn?: string;
  MaxNumberOfMessagesPerSecond?: number;
  ApproximateNumberOfMessagesMoved?: number;
  ApproximateNumberOfMessagesToMove?: number;
  FailureReason?: string;
  StartedTimestamp?: number;
}
export interface ListMessageMoveTasksResult {
  Results?: ListMessageMoveTasksResultEntry[];
}
export interface ListQueuesRequest {
  QueueNamePrefix?: string;
  NextToken?: string;
  MaxResults?: number;
}
export interface ListQueuesResult {
  NextToken?: string;
  QueueUrls?: string[];
}
export interface ListQueueTagsRequest {
  QueueUrl: string | undefined;
}
export interface ListQueueTagsResult {
  Tags?: Record<string, string>;
}
export declare class PurgeQueueInProgress extends __BaseException {
  readonly name: "PurgeQueueInProgress";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<PurgeQueueInProgress, __BaseException>
  );
}
export interface PurgeQueueRequest {
  QueueUrl: string | undefined;
}
export interface ReceiveMessageRequest {
  QueueUrl: string | undefined;
  AttributeNames?: (QueueAttributeName | string)[];
  MessageAttributeNames?: string[];
  MaxNumberOfMessages?: number;
  VisibilityTimeout?: number;
  WaitTimeSeconds?: number;
  ReceiveRequestAttemptId?: string;
}
export declare const MessageSystemAttributeName: {
  readonly AWSTraceHeader: "AWSTraceHeader";
  readonly ApproximateFirstReceiveTimestamp: "ApproximateFirstReceiveTimestamp";
  readonly ApproximateReceiveCount: "ApproximateReceiveCount";
  readonly DeadLetterQueueSourceArn: "DeadLetterQueueSourceArn";
  readonly MessageDeduplicationId: "MessageDeduplicationId";
  readonly MessageGroupId: "MessageGroupId";
  readonly SenderId: "SenderId";
  readonly SentTimestamp: "SentTimestamp";
  readonly SequenceNumber: "SequenceNumber";
};
export type MessageSystemAttributeName =
  (typeof MessageSystemAttributeName)[keyof typeof MessageSystemAttributeName];
export interface MessageAttributeValue {
  StringValue?: string;
  BinaryValue?: Uint8Array;
  StringListValues?: string[];
  BinaryListValues?: Uint8Array[];
  DataType: string | undefined;
}
export interface Message {
  MessageId?: string;
  ReceiptHandle?: string;
  MD5OfBody?: string;
  Body?: string;
  Attributes?: Record<string, string>;
  MD5OfMessageAttributes?: string;
  MessageAttributes?: Record<string, MessageAttributeValue>;
}
export interface ReceiveMessageResult {
  Messages?: Message[];
}
export interface RemovePermissionRequest {
  QueueUrl: string | undefined;
  Label: string | undefined;
}
export declare class InvalidMessageContents extends __BaseException {
  readonly name: "InvalidMessageContents";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<InvalidMessageContents, __BaseException>
  );
}
export declare const MessageSystemAttributeNameForSends: {
  readonly AWSTraceHeader: "AWSTraceHeader";
};
export type MessageSystemAttributeNameForSends =
  (typeof MessageSystemAttributeNameForSends)[keyof typeof MessageSystemAttributeNameForSends];
export interface MessageSystemAttributeValue {
  StringValue?: string;
  BinaryValue?: Uint8Array;
  StringListValues?: string[];
  BinaryListValues?: Uint8Array[];
  DataType: string | undefined;
}
export interface SendMessageRequest {
  QueueUrl: string | undefined;
  MessageBody: string | undefined;
  DelaySeconds?: number;
  MessageAttributes?: Record<string, MessageAttributeValue>;
  MessageSystemAttributes?: Record<string, MessageSystemAttributeValue>;
  MessageDeduplicationId?: string;
  MessageGroupId?: string;
}
export interface SendMessageResult {
  MD5OfMessageBody?: string;
  MD5OfMessageAttributes?: string;
  MD5OfMessageSystemAttributes?: string;
  MessageId?: string;
  SequenceNumber?: string;
}
export declare class BatchRequestTooLong extends __BaseException {
  readonly name: "BatchRequestTooLong";
  readonly $fault: "client";
  constructor(
    opts: __ExceptionOptionType<BatchRequestTooLong, __BaseException>
  );
}
export interface SendMessageBatchRequestEntry {
  Id: string | undefined;
  MessageBody: string | undefined;
  DelaySeconds?: number;
  MessageAttributes?: Record<string, MessageAttributeValue>;
  MessageSystemAttributes?: Record<string, MessageSystemAttributeValue>;
  MessageDeduplicationId?: string;
  MessageGroupId?: string;
}
export interface SendMessageBatchRequest {
  QueueUrl: string | undefined;
  Entries: SendMessageBatchRequestEntry[] | undefined;
}
export interface SendMessageBatchResultEntry {
  Id: string | undefined;
  MessageId: string | undefined;
  MD5OfMessageBody: string | undefined;
  MD5OfMessageAttributes?: string;
  MD5OfMessageSystemAttributes?: string;
  SequenceNumber?: string;
}
export interface SendMessageBatchResult {
  Successful: SendMessageBatchResultEntry[] | undefined;
  Failed: BatchResultErrorEntry[] | undefined;
}
export interface SetQueueAttributesRequest {
  QueueUrl: string | undefined;
  Attributes: Record<string, string> | undefined;
}
export interface StartMessageMoveTaskRequest {
  SourceArn: string | undefined;
  DestinationArn?: string;
  MaxNumberOfMessagesPerSecond?: number;
}
export interface StartMessageMoveTaskResult {
  TaskHandle?: string;
}
export interface TagQueueRequest {
  QueueUrl: string | undefined;
  Tags: Record<string, string> | undefined;
}
export interface UntagQueueRequest {
  QueueUrl: string | undefined;
  TagKeys: string[] | undefined;
}
