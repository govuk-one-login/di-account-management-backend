import { SQSServiceException as __BaseException } from "./SQSServiceException";
export class OverLimit extends __BaseException {
    constructor(opts) {
        super({
            name: "OverLimit",
            $fault: "client",
            ...opts,
        });
        this.name = "OverLimit";
        this.$fault = "client";
        Object.setPrototypeOf(this, OverLimit.prototype);
    }
}
export class ResourceNotFoundException extends __BaseException {
    constructor(opts) {
        super({
            name: "ResourceNotFoundException",
            $fault: "client",
            ...opts,
        });
        this.name = "ResourceNotFoundException";
        this.$fault = "client";
        Object.setPrototypeOf(this, ResourceNotFoundException.prototype);
    }
}
export class UnsupportedOperation extends __BaseException {
    constructor(opts) {
        super({
            name: "UnsupportedOperation",
            $fault: "client",
            ...opts,
        });
        this.name = "UnsupportedOperation";
        this.$fault = "client";
        Object.setPrototypeOf(this, UnsupportedOperation.prototype);
    }
}
export class MessageNotInflight extends __BaseException {
    constructor(opts) {
        super({
            name: "MessageNotInflight",
            $fault: "client",
            ...opts,
        });
        this.name = "MessageNotInflight";
        this.$fault = "client";
        Object.setPrototypeOf(this, MessageNotInflight.prototype);
    }
}
export class ReceiptHandleIsInvalid extends __BaseException {
    constructor(opts) {
        super({
            name: "ReceiptHandleIsInvalid",
            $fault: "client",
            ...opts,
        });
        this.name = "ReceiptHandleIsInvalid";
        this.$fault = "client";
        Object.setPrototypeOf(this, ReceiptHandleIsInvalid.prototype);
    }
}
export class BatchEntryIdsNotDistinct extends __BaseException {
    constructor(opts) {
        super({
            name: "BatchEntryIdsNotDistinct",
            $fault: "client",
            ...opts,
        });
        this.name = "BatchEntryIdsNotDistinct";
        this.$fault = "client";
        Object.setPrototypeOf(this, BatchEntryIdsNotDistinct.prototype);
    }
}
export class EmptyBatchRequest extends __BaseException {
    constructor(opts) {
        super({
            name: "EmptyBatchRequest",
            $fault: "client",
            ...opts,
        });
        this.name = "EmptyBatchRequest";
        this.$fault = "client";
        Object.setPrototypeOf(this, EmptyBatchRequest.prototype);
    }
}
export class InvalidBatchEntryId extends __BaseException {
    constructor(opts) {
        super({
            name: "InvalidBatchEntryId",
            $fault: "client",
            ...opts,
        });
        this.name = "InvalidBatchEntryId";
        this.$fault = "client";
        Object.setPrototypeOf(this, InvalidBatchEntryId.prototype);
    }
}
export class TooManyEntriesInBatchRequest extends __BaseException {
    constructor(opts) {
        super({
            name: "TooManyEntriesInBatchRequest",
            $fault: "client",
            ...opts,
        });
        this.name = "TooManyEntriesInBatchRequest";
        this.$fault = "client";
        Object.setPrototypeOf(this, TooManyEntriesInBatchRequest.prototype);
    }
}
export const QueueAttributeName = {
    All: "All",
    ApproximateNumberOfMessages: "ApproximateNumberOfMessages",
    ApproximateNumberOfMessagesDelayed: "ApproximateNumberOfMessagesDelayed",
    ApproximateNumberOfMessagesNotVisible: "ApproximateNumberOfMessagesNotVisible",
    ContentBasedDeduplication: "ContentBasedDeduplication",
    CreatedTimestamp: "CreatedTimestamp",
    DeduplicationScope: "DeduplicationScope",
    DelaySeconds: "DelaySeconds",
    FifoQueue: "FifoQueue",
    FifoThroughputLimit: "FifoThroughputLimit",
    KmsDataKeyReusePeriodSeconds: "KmsDataKeyReusePeriodSeconds",
    KmsMasterKeyId: "KmsMasterKeyId",
    LastModifiedTimestamp: "LastModifiedTimestamp",
    MaximumMessageSize: "MaximumMessageSize",
    MessageRetentionPeriod: "MessageRetentionPeriod",
    Policy: "Policy",
    QueueArn: "QueueArn",
    ReceiveMessageWaitTimeSeconds: "ReceiveMessageWaitTimeSeconds",
    RedriveAllowPolicy: "RedriveAllowPolicy",
    RedrivePolicy: "RedrivePolicy",
    SqsManagedSseEnabled: "SqsManagedSseEnabled",
    VisibilityTimeout: "VisibilityTimeout",
};
export class QueueDeletedRecently extends __BaseException {
    constructor(opts) {
        super({
            name: "QueueDeletedRecently",
            $fault: "client",
            ...opts,
        });
        this.name = "QueueDeletedRecently";
        this.$fault = "client";
        Object.setPrototypeOf(this, QueueDeletedRecently.prototype);
    }
}
export class QueueNameExists extends __BaseException {
    constructor(opts) {
        super({
            name: "QueueNameExists",
            $fault: "client",
            ...opts,
        });
        this.name = "QueueNameExists";
        this.$fault = "client";
        Object.setPrototypeOf(this, QueueNameExists.prototype);
    }
}
export class InvalidIdFormat extends __BaseException {
    constructor(opts) {
        super({
            name: "InvalidIdFormat",
            $fault: "client",
            ...opts,
        });
        this.name = "InvalidIdFormat";
        this.$fault = "client";
        Object.setPrototypeOf(this, InvalidIdFormat.prototype);
    }
}
export class InvalidAttributeName extends __BaseException {
    constructor(opts) {
        super({
            name: "InvalidAttributeName",
            $fault: "client",
            ...opts,
        });
        this.name = "InvalidAttributeName";
        this.$fault = "client";
        Object.setPrototypeOf(this, InvalidAttributeName.prototype);
    }
}
export class QueueDoesNotExist extends __BaseException {
    constructor(opts) {
        super({
            name: "QueueDoesNotExist",
            $fault: "client",
            ...opts,
        });
        this.name = "QueueDoesNotExist";
        this.$fault = "client";
        Object.setPrototypeOf(this, QueueDoesNotExist.prototype);
    }
}
export class PurgeQueueInProgress extends __BaseException {
    constructor(opts) {
        super({
            name: "PurgeQueueInProgress",
            $fault: "client",
            ...opts,
        });
        this.name = "PurgeQueueInProgress";
        this.$fault = "client";
        Object.setPrototypeOf(this, PurgeQueueInProgress.prototype);
    }
}
export const MessageSystemAttributeName = {
    AWSTraceHeader: "AWSTraceHeader",
    ApproximateFirstReceiveTimestamp: "ApproximateFirstReceiveTimestamp",
    ApproximateReceiveCount: "ApproximateReceiveCount",
    DeadLetterQueueSourceArn: "DeadLetterQueueSourceArn",
    MessageDeduplicationId: "MessageDeduplicationId",
    MessageGroupId: "MessageGroupId",
    SenderId: "SenderId",
    SentTimestamp: "SentTimestamp",
    SequenceNumber: "SequenceNumber",
};
export class InvalidMessageContents extends __BaseException {
    constructor(opts) {
        super({
            name: "InvalidMessageContents",
            $fault: "client",
            ...opts,
        });
        this.name = "InvalidMessageContents";
        this.$fault = "client";
        Object.setPrototypeOf(this, InvalidMessageContents.prototype);
    }
}
export const MessageSystemAttributeNameForSends = {
    AWSTraceHeader: "AWSTraceHeader",
};
export class BatchRequestTooLong extends __BaseException {
    constructor(opts) {
        super({
            name: "BatchRequestTooLong",
            $fault: "client",
            ...opts,
        });
        this.name = "BatchRequestTooLong";
        this.$fault = "client";
        Object.setPrototypeOf(this, BatchRequestTooLong.prototype);
    }
}
