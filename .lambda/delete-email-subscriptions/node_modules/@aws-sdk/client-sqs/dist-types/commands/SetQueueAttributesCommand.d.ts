import { EndpointParameterInstructions } from "@smithy/middleware-endpoint";
import { Command as $Command } from "@smithy/smithy-client";
import { Handler, HttpHandlerOptions as __HttpHandlerOptions, MetadataBearer as __MetadataBearer, MiddlewareStack } from "@smithy/types";
import { SetQueueAttributesRequest } from "../models/models_0";
import { ServiceInputTypes, ServiceOutputTypes, SQSClientResolvedConfig } from "../SQSClient";
/**
 * @public
 */
export { __MetadataBearer, $Command };
/**
 * @public
 *
 * The input for {@link SetQueueAttributesCommand}.
 */
export interface SetQueueAttributesCommandInput extends SetQueueAttributesRequest {
}
/**
 * @public
 *
 * The output of {@link SetQueueAttributesCommand}.
 */
export interface SetQueueAttributesCommandOutput extends __MetadataBearer {
}
/**
 * @public
 * <p>Sets the value of one or more queue attributes. When you change a queue's attributes,
 *             the change can take up to 60 seconds for most of the attributes to propagate throughout
 *             the Amazon SQS system. Changes made to the <code>MessageRetentionPeriod</code> attribute can
 *             take up to 15 minutes and will impact existing messages in the queue potentially causing
 *             them to be expired and deleted if the <code>MessageRetentionPeriod</code> is reduced
 *             below the age of existing messages.</p>
 *          <note>
 *             <ul>
 *                <li>
 *                   <p>In the future, new attributes might be added. If you write code that calls this action, we recommend that you structure your code so that it can handle new attributes gracefully.</p>
 *                </li>
 *                <li>
 *                   <p>Cross-account permissions don't apply to this action. For more information,
 * see <a href="https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-customer-managed-policy-examples.html#grant-cross-account-permissions-to-role-and-user-name">Grant
 * cross-account permissions to a role and a username</a> in the <i>Amazon SQS Developer Guide</i>.</p>
 *                </li>
 *                <li>
 *                   <p>To remove the ability to change queue permissions, you must deny permission to the <code>AddPermission</code>, <code>RemovePermission</code>, and <code>SetQueueAttributes</code> actions in your IAM policy.</p>
 *                </li>
 *             </ul>
 *          </note>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { SQSClient, SetQueueAttributesCommand } from "@aws-sdk/client-sqs"; // ES Modules import
 * // const { SQSClient, SetQueueAttributesCommand } = require("@aws-sdk/client-sqs"); // CommonJS import
 * const client = new SQSClient(config);
 * const input = { // SetQueueAttributesRequest
 *   QueueUrl: "STRING_VALUE", // required
 *   Attributes: { // QueueAttributeMap // required
 *     "<keys>": "STRING_VALUE",
 *   },
 * };
 * const command = new SetQueueAttributesCommand(input);
 * const response = await client.send(command);
 * // {};
 *
 * ```
 *
 * @param SetQueueAttributesCommandInput - {@link SetQueueAttributesCommandInput}
 * @returns {@link SetQueueAttributesCommandOutput}
 * @see {@link SetQueueAttributesCommandInput} for command's `input` shape.
 * @see {@link SetQueueAttributesCommandOutput} for command's `response` shape.
 * @see {@link SQSClientResolvedConfig | config} for SQSClient's `config` shape.
 *
 * @throws {@link InvalidAttributeName} (client fault)
 *  <p>The specified attribute doesn't exist.</p>
 *
 * @throws {@link SQSServiceException}
 * <p>Base exception class for all service exceptions from SQS service.</p>
 *
 */
export declare class SetQueueAttributesCommand extends $Command<SetQueueAttributesCommandInput, SetQueueAttributesCommandOutput, SQSClientResolvedConfig> {
    readonly input: SetQueueAttributesCommandInput;
    static getEndpointParameterInstructions(): EndpointParameterInstructions;
    /**
     * @public
     */
    constructor(input: SetQueueAttributesCommandInput);
    /**
     * @internal
     */
    resolveMiddleware(clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>, configuration: SQSClientResolvedConfig, options?: __HttpHandlerOptions): Handler<SetQueueAttributesCommandInput, SetQueueAttributesCommandOutput>;
    /**
     * @internal
     */
    private serialize;
    /**
     * @internal
     */
    private deserialize;
}
