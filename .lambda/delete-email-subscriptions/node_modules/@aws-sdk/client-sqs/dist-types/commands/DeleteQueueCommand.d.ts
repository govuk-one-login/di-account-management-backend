import { EndpointParameterInstructions } from "@smithy/middleware-endpoint";
import { Command as $Command } from "@smithy/smithy-client";
import { Handler, HttpHandlerOptions as __HttpHandlerOptions, MetadataBearer as __MetadataBearer, MiddlewareStack } from "@smithy/types";
import { DeleteQueueRequest } from "../models/models_0";
import { ServiceInputTypes, ServiceOutputTypes, SQSClientResolvedConfig } from "../SQSClient";
/**
 * @public
 */
export { __MetadataBearer, $Command };
/**
 * @public
 *
 * The input for {@link DeleteQueueCommand}.
 */
export interface DeleteQueueCommandInput extends DeleteQueueRequest {
}
/**
 * @public
 *
 * The output of {@link DeleteQueueCommand}.
 */
export interface DeleteQueueCommandOutput extends __MetadataBearer {
}
/**
 * @public
 * <p>Deletes the queue specified by the <code>QueueUrl</code>, regardless of the queue's
 *             contents.</p>
 *          <important>
 *             <p>Be careful with the <code>DeleteQueue</code> action: When you delete a queue, any
 *                 messages in the queue are no longer available. </p>
 *          </important>
 *          <p>When you delete a queue, the deletion process takes up to 60 seconds. Requests you
 *             send involving that queue during the 60 seconds might succeed. For example, a
 *                     <code>
 *                <a>SendMessage</a>
 *             </code> request might succeed, but after 60
 *             seconds the queue and the message you sent no longer exist.</p>
 *          <p>When you delete a queue, you must wait at least 60 seconds before creating a queue
 *             with the same name.</p>
 *          <note>
 *             <p>Cross-account permissions don't apply to this action. For more information,
 * see <a href="https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-customer-managed-policy-examples.html#grant-cross-account-permissions-to-role-and-user-name">Grant
 * cross-account permissions to a role and a username</a> in the <i>Amazon SQS Developer Guide</i>.</p>
 *             <p>The delete operation uses the HTTP <code>GET</code> verb.</p>
 *          </note>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { SQSClient, DeleteQueueCommand } from "@aws-sdk/client-sqs"; // ES Modules import
 * // const { SQSClient, DeleteQueueCommand } = require("@aws-sdk/client-sqs"); // CommonJS import
 * const client = new SQSClient(config);
 * const input = { // DeleteQueueRequest
 *   QueueUrl: "STRING_VALUE", // required
 * };
 * const command = new DeleteQueueCommand(input);
 * const response = await client.send(command);
 * // {};
 *
 * ```
 *
 * @param DeleteQueueCommandInput - {@link DeleteQueueCommandInput}
 * @returns {@link DeleteQueueCommandOutput}
 * @see {@link DeleteQueueCommandInput} for command's `input` shape.
 * @see {@link DeleteQueueCommandOutput} for command's `response` shape.
 * @see {@link SQSClientResolvedConfig | config} for SQSClient's `config` shape.
 *
 * @throws {@link SQSServiceException}
 * <p>Base exception class for all service exceptions from SQS service.</p>
 *
 */
export declare class DeleteQueueCommand extends $Command<DeleteQueueCommandInput, DeleteQueueCommandOutput, SQSClientResolvedConfig> {
    readonly input: DeleteQueueCommandInput;
    static getEndpointParameterInstructions(): EndpointParameterInstructions;
    /**
     * @public
     */
    constructor(input: DeleteQueueCommandInput);
    /**
     * @internal
     */
    resolveMiddleware(clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>, configuration: SQSClientResolvedConfig, options?: __HttpHandlerOptions): Handler<DeleteQueueCommandInput, DeleteQueueCommandOutput>;
    /**
     * @internal
     */
    private serialize;
    /**
     * @internal
     */
    private deserialize;
}
