"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchRequestTooLong = exports.MessageSystemAttributeNameForSends = exports.InvalidMessageContents = exports.MessageSystemAttributeName = exports.PurgeQueueInProgress = exports.QueueDoesNotExist = exports.InvalidAttributeName = exports.InvalidIdFormat = exports.QueueNameExists = exports.QueueDeletedRecently = exports.QueueAttributeName = exports.TooManyEntriesInBatchRequest = exports.InvalidBatchEntryId = exports.EmptyBatchRequest = exports.BatchEntryIdsNotDistinct = exports.ReceiptHandleIsInvalid = exports.MessageNotInflight = exports.UnsupportedOperation = exports.ResourceNotFoundException = exports.OverLimit = void 0;
const SQSServiceException_1 = require("./SQSServiceException");
class OverLimit extends SQSServiceException_1.SQSServiceException {
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
exports.OverLimit = OverLimit;
class ResourceNotFoundException extends SQSServiceException_1.SQSServiceException {
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
exports.ResourceNotFoundException = ResourceNotFoundException;
class UnsupportedOperation extends SQSServiceException_1.SQSServiceException {
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
exports.UnsupportedOperation = UnsupportedOperation;
class MessageNotInflight extends SQSServiceException_1.SQSServiceException {
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
exports.MessageNotInflight = MessageNotInflight;
class ReceiptHandleIsInvalid extends SQSServiceException_1.SQSServiceException {
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
exports.ReceiptHandleIsInvalid = ReceiptHandleIsInvalid;
class BatchEntryIdsNotDistinct extends SQSServiceException_1.SQSServiceException {
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
exports.BatchEntryIdsNotDistinct = BatchEntryIdsNotDistinct;
class EmptyBatchRequest extends SQSServiceException_1.SQSServiceException {
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
exports.EmptyBatchRequest = EmptyBatchRequest;
class InvalidBatchEntryId extends SQSServiceException_1.SQSServiceException {
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
exports.InvalidBatchEntryId = InvalidBatchEntryId;
class TooManyEntriesInBatchRequest extends SQSServiceException_1.SQSServiceException {
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
exports.TooManyEntriesInBatchRequest = TooManyEntriesInBatchRequest;
exports.QueueAttributeName = {
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
class QueueDeletedRecently extends SQSServiceException_1.SQSServiceException {
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
exports.QueueDeletedRecently = QueueDeletedRecently;
class QueueNameExists extends SQSServiceException_1.SQSServiceException {
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
exports.QueueNameExists = QueueNameExists;
class InvalidIdFormat extends SQSServiceException_1.SQSServiceException {
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
exports.InvalidIdFormat = InvalidIdFormat;
class InvalidAttributeName extends SQSServiceException_1.SQSServiceException {
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
exports.InvalidAttributeName = InvalidAttributeName;
class QueueDoesNotExist extends SQSServiceException_1.SQSServiceException {
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
exports.QueueDoesNotExist = QueueDoesNotExist;
class PurgeQueueInProgress extends SQSServiceException_1.SQSServiceException {
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
exports.PurgeQueueInProgress = PurgeQueueInProgress;
exports.MessageSystemAttributeName = {
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
class InvalidMessageContents extends SQSServiceException_1.SQSServiceException {
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
exports.InvalidMessageContents = InvalidMessageContents;
exports.MessageSystemAttributeNameForSends = {
    AWSTraceHeader: "AWSTraceHeader",
};
class BatchRequestTooLong extends SQSServiceException_1.SQSServiceException {
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
exports.BatchRequestTooLong = BatchRequestTooLong;
