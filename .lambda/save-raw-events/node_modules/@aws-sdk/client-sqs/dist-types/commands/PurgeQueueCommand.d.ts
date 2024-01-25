import { EndpointParameterInstructions } from "@smithy/middleware-endpoint";
import { Command as $Command } from "@smithy/smithy-client";
import { Handler, HttpHandlerOptions as __HttpHandlerOptions, MetadataBearer as __MetadataBearer, MiddlewareStack } from "@smithy/types";
import { PurgeQueueRequest } from "../models/models_0";
import { ServiceInputTypes, ServiceOutputTypes, SQSClientResolvedConfig } from "../SQSClient";
/**
 * @public
 */
export { __MetadataBearer, $Command };
/**
 * @public
 *
 * The input for {@link PurgeQueueCommand}.
 */
export interface PurgeQueueCommandInput extends PurgeQueueRequest {
}
/**
 * @public
 *
 * The output of {@link PurgeQueueCommand}.
 */
export interface PurgeQueueCommandOutput extends __MetadataBearer {
}
/**
 * @public
 * <p>Deletes available messages in a queue (including in-flight messages) specified by the
 *                 <code>QueueURL</code> parameter.</p>
 *          <important>
 *             <p>When you use the <code>PurgeQueue</code> action, you can't retrieve any messages
 *                 deleted from a queue.</p>
 *             <p>The message deletion process takes up to 60 seconds. We recommend waiting for 60
 *                 seconds regardless of your queue's size. </p>
 *          </important>
 *          <p>Messages sent to the queue <i>before</i> you call
 *                 <code>PurgeQueue</code> might be received but are deleted within the next
 *             minute.</p>
 *          <p>Messages sent to the queue <i>after</i> you call <code>PurgeQueue</code>
 *             might be deleted while the queue is being purged.</p>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { SQSClient, PurgeQueueCommand } from "@aws-sdk/client-sqs"; // ES Modules import
 * // const { SQSClient, PurgeQueueCommand } = require("@aws-sdk/client-sqs"); // CommonJS import
 * const client = new SQSClient(config);
 * const input = { // PurgeQueueRequest
 *   QueueUrl: "STRING_VALUE", // required
 * };
 * const command = new PurgeQueueCommand(input);
 * const response = await client.send(command);
 * // {};
 *
 * ```
 *
 * @param PurgeQueueCommandInput - {@link PurgeQueueCommandInput}
 * @returns {@link PurgeQueueCommandOutput}
 * @see {@link PurgeQueueCommandInput} for command's `input` shape.
 * @see {@link PurgeQueueCommandOutput} for command's `response` shape.
 * @see {@link SQSClientResolvedConfig | config} for SQSClient's `config` shape.
 *
 * @throws {@link PurgeQueueInProgress} (client fault)
 *  <p>Indicates that the specified queue previously received a <code>PurgeQueue</code>
 *             request within the last 60 seconds (the time it can take to delete the messages in the
 *             queue).</p>
 *
 * @throws {@link QueueDoesNotExist} (client fault)
 *  <p>The specified queue doesn't exist.</p>
 *
 * @throws {@link SQSServiceException}
 * <p>Base exception class for all service exceptions from SQS service.</p>
 *
 */
export declare class PurgeQueueCommand extends $Command<PurgeQueueCommandInput, PurgeQueueCommandOutput, SQSClientResolvedConfig> {
    readonly input: PurgeQueueCommandInput;
    static getEndpointParameterInstructions(): EndpointParameterInstructions;
    /**
     * @public
     */
    constructor(input: PurgeQueueCommandInput);
    /**
     * @internal
     */
    resolveMiddleware(clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>, configuration: SQSClientResolvedConfig, options?: __HttpHandlerOptions): Handler<PurgeQueueCommandInput, PurgeQueueCommandOutput>;
    /**
     * @internal
     */
    private serialize;
    /**
     * @internal
     */
    private deserialize;
}
