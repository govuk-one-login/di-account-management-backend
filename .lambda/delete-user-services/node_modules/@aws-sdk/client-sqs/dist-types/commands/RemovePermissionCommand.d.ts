import { EndpointParameterInstructions } from "@smithy/middleware-endpoint";
import { Command as $Command } from "@smithy/smithy-client";
import { Handler, HttpHandlerOptions as __HttpHandlerOptions, MetadataBearer as __MetadataBearer, MiddlewareStack } from "@smithy/types";
import { RemovePermissionRequest } from "../models/models_0";
import { ServiceInputTypes, ServiceOutputTypes, SQSClientResolvedConfig } from "../SQSClient";
/**
 * @public
 */
export { __MetadataBearer, $Command };
/**
 * @public
 *
 * The input for {@link RemovePermissionCommand}.
 */
export interface RemovePermissionCommandInput extends RemovePermissionRequest {
}
/**
 * @public
 *
 * The output of {@link RemovePermissionCommand}.
 */
export interface RemovePermissionCommandOutput extends __MetadataBearer {
}
/**
 * @public
 * <p>Revokes any permissions in the queue policy that matches the specified
 *                 <code>Label</code> parameter.</p>
 *          <note>
 *             <ul>
 *                <li>
 *                   <p>Only the owner of a queue can remove permissions from it.</p>
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
 * import { SQSClient, RemovePermissionCommand } from "@aws-sdk/client-sqs"; // ES Modules import
 * // const { SQSClient, RemovePermissionCommand } = require("@aws-sdk/client-sqs"); // CommonJS import
 * const client = new SQSClient(config);
 * const input = { // RemovePermissionRequest
 *   QueueUrl: "STRING_VALUE", // required
 *   Label: "STRING_VALUE", // required
 * };
 * const command = new RemovePermissionCommand(input);
 * const response = await client.send(command);
 * // {};
 *
 * ```
 *
 * @param RemovePermissionCommandInput - {@link RemovePermissionCommandInput}
 * @returns {@link RemovePermissionCommandOutput}
 * @see {@link RemovePermissionCommandInput} for command's `input` shape.
 * @see {@link RemovePermissionCommandOutput} for command's `response` shape.
 * @see {@link SQSClientResolvedConfig | config} for SQSClient's `config` shape.
 *
 * @throws {@link SQSServiceException}
 * <p>Base exception class for all service exceptions from SQS service.</p>
 *
 */
export declare class RemovePermissionCommand extends $Command<RemovePermissionCommandInput, RemovePermissionCommandOutput, SQSClientResolvedConfig> {
    readonly input: RemovePermissionCommandInput;
    static getEndpointParameterInstructions(): EndpointParameterInstructions;
    /**
     * @public
     */
    constructor(input: RemovePermissionCommandInput);
    /**
     * @internal
     */
    resolveMiddleware(clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>, configuration: SQSClientResolvedConfig, options?: __HttpHandlerOptions): Handler<RemovePermissionCommandInput, RemovePermissionCommandOutput>;
    /**
     * @internal
     */
    private serialize;
    /**
     * @internal
     */
    private deserialize;
}
