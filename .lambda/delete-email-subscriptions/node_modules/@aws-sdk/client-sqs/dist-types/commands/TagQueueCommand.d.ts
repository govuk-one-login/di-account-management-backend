import { EndpointParameterInstructions } from "@smithy/middleware-endpoint";
import { Command as $Command } from "@smithy/smithy-client";
import { Handler, HttpHandlerOptions as __HttpHandlerOptions, MetadataBearer as __MetadataBearer, MiddlewareStack } from "@smithy/types";
import { TagQueueRequest } from "../models/models_0";
import { ServiceInputTypes, ServiceOutputTypes, SQSClientResolvedConfig } from "../SQSClient";
/**
 * @public
 */
export { __MetadataBearer, $Command };
/**
 * @public
 *
 * The input for {@link TagQueueCommand}.
 */
export interface TagQueueCommandInput extends TagQueueRequest {
}
/**
 * @public
 *
 * The output of {@link TagQueueCommand}.
 */
export interface TagQueueCommandOutput extends __MetadataBearer {
}
/**
 * @public
 * <p>Add cost allocation tags to the specified Amazon SQS queue. For an overview, see <a href="https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-queue-tags.html">Tagging
 * Your Amazon SQS Queues</a> in the <i>Amazon SQS Developer Guide</i>.</p>
 *          <p>When you use queue tags, keep the following guidelines in mind:</p>
 *          <ul>
 *             <li>
 *                <p>Adding more than 50 tags to a queue isn't recommended.</p>
 *             </li>
 *             <li>
 *                <p>Tags don't have any semantic meaning. Amazon SQS interprets tags as character strings.</p>
 *             </li>
 *             <li>
 *                <p>Tags are case-sensitive.</p>
 *             </li>
 *             <li>
 *                <p>A new tag with a key identical to that of an existing tag overwrites the existing tag.</p>
 *             </li>
 *          </ul>
 *          <p>For a full list of tag restrictions, see
 * <a href="https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-limits.html#limits-queues">Quotas related to queues</a>
 * in the <i>Amazon SQS Developer Guide</i>.</p>
 *          <note>
 *             <p>Cross-account permissions don't apply to this action. For more information,
 * see <a href="https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-customer-managed-policy-examples.html#grant-cross-account-permissions-to-role-and-user-name">Grant
 * cross-account permissions to a role and a username</a> in the <i>Amazon SQS Developer Guide</i>.</p>
 *          </note>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { SQSClient, TagQueueCommand } from "@aws-sdk/client-sqs"; // ES Modules import
 * // const { SQSClient, TagQueueCommand } = require("@aws-sdk/client-sqs"); // CommonJS import
 * const client = new SQSClient(config);
 * const input = { // TagQueueRequest
 *   QueueUrl: "STRING_VALUE", // required
 *   Tags: { // TagMap // required
 *     "<keys>": "STRING_VALUE",
 *   },
 * };
 * const command = new TagQueueCommand(input);
 * const response = await client.send(command);
 * // {};
 *
 * ```
 *
 * @param TagQueueCommandInput - {@link TagQueueCommandInput}
 * @returns {@link TagQueueCommandOutput}
 * @see {@link TagQueueCommandInput} for command's `input` shape.
 * @see {@link TagQueueCommandOutput} for command's `response` shape.
 * @see {@link SQSClientResolvedConfig | config} for SQSClient's `config` shape.
 *
 * @throws {@link SQSServiceException}
 * <p>Base exception class for all service exceptions from SQS service.</p>
 *
 */
export declare class TagQueueCommand extends $Command<TagQueueCommandInput, TagQueueCommandOutput, SQSClientResolvedConfig> {
    readonly input: TagQueueCommandInput;
    static getEndpointParameterInstructions(): EndpointParameterInstructions;
    /**
     * @public
     */
    constructor(input: TagQueueCommandInput);
    /**
     * @internal
     */
    resolveMiddleware(clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>, configuration: SQSClientResolvedConfig, options?: __HttpHandlerOptions): Handler<TagQueueCommandInput, TagQueueCommandOutput>;
    /**
     * @internal
     */
    private serialize;
    /**
     * @internal
     */
    private deserialize;
}
