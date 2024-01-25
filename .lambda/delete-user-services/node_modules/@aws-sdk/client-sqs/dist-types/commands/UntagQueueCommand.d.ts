import { EndpointParameterInstructions } from "@smithy/middleware-endpoint";
import { Command as $Command } from "@smithy/smithy-client";
import { Handler, HttpHandlerOptions as __HttpHandlerOptions, MetadataBearer as __MetadataBearer, MiddlewareStack } from "@smithy/types";
import { UntagQueueRequest } from "../models/models_0";
import { ServiceInputTypes, ServiceOutputTypes, SQSClientResolvedConfig } from "../SQSClient";
/**
 * @public
 */
export { __MetadataBearer, $Command };
/**
 * @public
 *
 * The input for {@link UntagQueueCommand}.
 */
export interface UntagQueueCommandInput extends UntagQueueRequest {
}
/**
 * @public
 *
 * The output of {@link UntagQueueCommand}.
 */
export interface UntagQueueCommandOutput extends __MetadataBearer {
}
/**
 * @public
 * <p>Remove cost allocation tags from the specified Amazon SQS queue. For an overview, see <a href="https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-queue-tags.html">Tagging
 * Your Amazon SQS Queues</a> in the <i>Amazon SQS Developer Guide</i>.</p>
 *          <note>
 *             <p>Cross-account permissions don't apply to this action. For more information,
 * see <a href="https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-customer-managed-policy-examples.html#grant-cross-account-permissions-to-role-and-user-name">Grant
 * cross-account permissions to a role and a username</a> in the <i>Amazon SQS Developer Guide</i>.</p>
 *          </note>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { SQSClient, UntagQueueCommand } from "@aws-sdk/client-sqs"; // ES Modules import
 * // const { SQSClient, UntagQueueCommand } = require("@aws-sdk/client-sqs"); // CommonJS import
 * const client = new SQSClient(config);
 * const input = { // UntagQueueRequest
 *   QueueUrl: "STRING_VALUE", // required
 *   TagKeys: [ // TagKeyList // required
 *     "STRING_VALUE",
 *   ],
 * };
 * const command = new UntagQueueCommand(input);
 * const response = await client.send(command);
 * // {};
 *
 * ```
 *
 * @param UntagQueueCommandInput - {@link UntagQueueCommandInput}
 * @returns {@link UntagQueueCommandOutput}
 * @see {@link UntagQueueCommandInput} for command's `input` shape.
 * @see {@link UntagQueueCommandOutput} for command's `response` shape.
 * @see {@link SQSClientResolvedConfig | config} for SQSClient's `config` shape.
 *
 * @throws {@link SQSServiceException}
 * <p>Base exception class for all service exceptions from SQS service.</p>
 *
 */
export declare class UntagQueueCommand extends $Command<UntagQueueCommandInput, UntagQueueCommandOutput, SQSClientResolvedConfig> {
    readonly input: UntagQueueCommandInput;
    static getEndpointParameterInstructions(): EndpointParameterInstructions;
    /**
     * @public
     */
    constructor(input: UntagQueueCommandInput);
    /**
     * @internal
     */
    resolveMiddleware(clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>, configuration: SQSClientResolvedConfig, options?: __HttpHandlerOptions): Handler<UntagQueueCommandInput, UntagQueueCommandOutput>;
    /**
     * @internal
     */
    private serialize;
    /**
     * @internal
     */
    private deserialize;
}
