import { EndpointParameterInstructions } from "@smithy/middleware-endpoint";
import { Command as $Command } from "@smithy/smithy-client";
import { Handler, HttpHandlerOptions as __HttpHandlerOptions, MetadataBearer as __MetadataBearer, MiddlewareStack } from "@smithy/types";
import { ListQueuesRequest, ListQueuesResult } from "../models/models_0";
import { ServiceInputTypes, ServiceOutputTypes, SQSClientResolvedConfig } from "../SQSClient";
/**
 * @public
 */
export { __MetadataBearer, $Command };
/**
 * @public
 *
 * The input for {@link ListQueuesCommand}.
 */
export interface ListQueuesCommandInput extends ListQueuesRequest {
}
/**
 * @public
 *
 * The output of {@link ListQueuesCommand}.
 */
export interface ListQueuesCommandOutput extends ListQueuesResult, __MetadataBearer {
}
/**
 * @public
 * <p>Returns a list of your queues in the current region. The response includes a maximum
 *             of 1,000 results. If you specify a value for the optional <code>QueueNamePrefix</code>
 *             parameter, only queues with a name that begins with the specified value are
 *             returned.</p>
 *          <p> The <code>listQueues</code> methods supports pagination. Set parameter
 *                 <code>MaxResults</code> in the request to specify the maximum number of results to
 *             be returned in the response. If you do not set <code>MaxResults</code>, the response
 *             includes a maximum of 1,000 results. If you set <code>MaxResults</code> and there are
 *             additional results to display, the response includes a value for <code>NextToken</code>.
 *             Use <code>NextToken</code> as a parameter in your next request to
 *                 <code>listQueues</code> to receive the next page of results. </p>
 *          <note>
 *             <p>Cross-account permissions don't apply to this action. For more information,
 * see <a href="https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-customer-managed-policy-examples.html#grant-cross-account-permissions-to-role-and-user-name">Grant
 * cross-account permissions to a role and a username</a> in the <i>Amazon SQS Developer Guide</i>.</p>
 *          </note>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { SQSClient, ListQueuesCommand } from "@aws-sdk/client-sqs"; // ES Modules import
 * // const { SQSClient, ListQueuesCommand } = require("@aws-sdk/client-sqs"); // CommonJS import
 * const client = new SQSClient(config);
 * const input = { // ListQueuesRequest
 *   QueueNamePrefix: "STRING_VALUE",
 *   NextToken: "STRING_VALUE",
 *   MaxResults: Number("int"),
 * };
 * const command = new ListQueuesCommand(input);
 * const response = await client.send(command);
 * // { // ListQueuesResult
 * //   NextToken: "STRING_VALUE",
 * //   QueueUrls: [ // QueueUrlList
 * //     "STRING_VALUE",
 * //   ],
 * // };
 *
 * ```
 *
 * @param ListQueuesCommandInput - {@link ListQueuesCommandInput}
 * @returns {@link ListQueuesCommandOutput}
 * @see {@link ListQueuesCommandInput} for command's `input` shape.
 * @see {@link ListQueuesCommandOutput} for command's `response` shape.
 * @see {@link SQSClientResolvedConfig | config} for SQSClient's `config` shape.
 *
 * @throws {@link SQSServiceException}
 * <p>Base exception class for all service exceptions from SQS service.</p>
 *
 */
export declare class ListQueuesCommand extends $Command<ListQueuesCommandInput, ListQueuesCommandOutput, SQSClientResolvedConfig> {
    readonly input: ListQueuesCommandInput;
    static getEndpointParameterInstructions(): EndpointParameterInstructions;
    /**
     * @public
     */
    constructor(input: ListQueuesCommandInput);
    /**
     * @internal
     */
    resolveMiddleware(clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>, configuration: SQSClientResolvedConfig, options?: __HttpHandlerOptions): Handler<ListQueuesCommandInput, ListQueuesCommandOutput>;
    /**
     * @internal
     */
    private serialize;
    /**
     * @internal
     */
    private deserialize;
}
