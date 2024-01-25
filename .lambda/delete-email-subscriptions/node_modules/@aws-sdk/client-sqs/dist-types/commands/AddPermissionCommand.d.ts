import { EndpointParameterInstructions } from "@smithy/middleware-endpoint";
import { Command as $Command } from "@smithy/smithy-client";
import { Handler, HttpHandlerOptions as __HttpHandlerOptions, MetadataBearer as __MetadataBearer, MiddlewareStack } from "@smithy/types";
import { AddPermissionRequest } from "../models/models_0";
import { ServiceInputTypes, ServiceOutputTypes, SQSClientResolvedConfig } from "../SQSClient";
/**
 * @public
 */
export { __MetadataBearer, $Command };
/**
 * @public
 *
 * The input for {@link AddPermissionCommand}.
 */
export interface AddPermissionCommandInput extends AddPermissionRequest {
}
/**
 * @public
 *
 * The output of {@link AddPermissionCommand}.
 */
export interface AddPermissionCommandOutput extends __MetadataBearer {
}
/**
 * @public
 * <p>Adds a permission to a queue for a specific <a href="https://docs.aws.amazon.com/general/latest/gr/glos-chap.html#P">principal</a>. This allows sharing
 *             access to the queue.</p>
 *          <p>When you create a queue, you have full control access rights for the queue. Only you,
 *             the owner of the queue, can grant or deny permissions to the queue. For more information
 *             about these permissions, see <a href="https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-writing-an-sqs-policy.html#write-messages-to-shared-queue">Allow Developers to Write Messages to a Shared Queue</a> in the <i>Amazon SQS
 *                 Developer Guide</i>.</p>
 *          <note>
 *             <ul>
 *                <li>
 *                   <p>
 *                      <code>AddPermission</code> generates a policy for you. You can use
 *                                 <code>
 *                         <a>SetQueueAttributes</a>
 *                      </code> to upload your
 *                         policy. For more information, see <a href="https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-creating-custom-policies.html">Using Custom Policies with the Amazon SQS Access Policy Language</a> in
 *                         the <i>Amazon SQS Developer Guide</i>.</p>
 *                </li>
 *                <li>
 *                   <p>An Amazon SQS policy can have a maximum of seven actions per statement.</p>
 *                </li>
 *                <li>
 *                   <p>To remove the ability to change queue permissions, you must deny permission to the <code>AddPermission</code>, <code>RemovePermission</code>, and <code>SetQueueAttributes</code> actions in your IAM policy.</p>
 *                </li>
 *                <li>
 *                   <p>Amazon SQS <code>AddPermission</code> does not support adding a non-account
 *                         principal.</p>
 *                </li>
 *             </ul>
 *          </note>
 *          <note>
 *             <p>Cross-account permissions don't apply to this action. For more information,
 * see <a href="https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-customer-managed-policy-examples.html#grant-cross-account-permissions-to-role-and-user-name">Grant
 * cross-account permissions to a role and a username</a> in the <i>Amazon SQS Developer Guide</i>.</p>
 *          </note>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { SQSClient, AddPermissionCommand } from "@aws-sdk/client-sqs"; // ES Modules import
 * // const { SQSClient, AddPermissionCommand } = require("@aws-sdk/client-sqs"); // CommonJS import
 * const client = new SQSClient(config);
 * const input = { // AddPermissionRequest
 *   QueueUrl: "STRING_VALUE", // required
 *   Label: "STRING_VALUE", // required
 *   AWSAccountIds: [ // AWSAccountIdList // required
 *     "STRING_VALUE",
 *   ],
 *   Actions: [ // ActionNameList // required
 *     "STRING_VALUE",
 *   ],
 * };
 * const command = new AddPermissionCommand(input);
 * const response = await client.send(command);
 * // {};
 *
 * ```
 *
 * @param AddPermissionCommandInput - {@link AddPermissionCommandInput}
 * @returns {@link AddPermissionCommandOutput}
 * @see {@link AddPermissionCommandInput} for command's `input` shape.
 * @see {@link AddPermissionCommandOutput} for command's `response` shape.
 * @see {@link SQSClientResolvedConfig | config} for SQSClient's `config` shape.
 *
 * @throws {@link OverLimit} (client fault)
 *  <p>The specified action violates a limit. For example, <code>ReceiveMessage</code>
 *             returns this error if the maximum number of in flight messages is reached and
 *                 <code>AddPermission</code> returns this error if the maximum number of permissions
 *             for the queue is reached.</p>
 *
 * @throws {@link SQSServiceException}
 * <p>Base exception class for all service exceptions from SQS service.</p>
 *
 */
export declare class AddPermissionCommand extends $Command<AddPermissionCommandInput, AddPermissionCommandOutput, SQSClientResolvedConfig> {
    readonly input: AddPermissionCommandInput;
    static getEndpointParameterInstructions(): EndpointParameterInstructions;
    /**
     * @public
     */
    constructor(input: AddPermissionCommandInput);
    /**
     * @internal
     */
    resolveMiddleware(clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>, configuration: SQSClientResolvedConfig, options?: __HttpHandlerOptions): Handler<AddPermissionCommandInput, AddPermissionCommandOutput>;
    /**
     * @internal
     */
    private serialize;
    /**
     * @internal
     */
    private deserialize;
}
