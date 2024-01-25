import { EndpointParameterInstructions } from "@smithy/middleware-endpoint";
import { Command as $Command } from "@smithy/smithy-client";
import { Handler, HttpHandlerOptions as __HttpHandlerOptions, MetadataBearer as __MetadataBearer, MiddlewareStack } from "@smithy/types";
import { ListDeadLetterSourceQueuesRequest, ListDeadLetterSourceQueuesResult } from "../models/models_0";
import { ServiceInputTypes, ServiceOutputTypes, SQSClientResolvedConfig } from "../SQSClient";
/**
 * @public
 */
export { __MetadataBearer, $Command };
/**
 * @public
 *
 * The input for {@link ListDeadLetterSourceQueuesCommand}.
 */
export interface ListDeadLetterSourceQueuesCommandInput extends ListDeadLetterSourceQueuesRequest {
}
/**
 * @public
 *
 * The output of {@link ListDeadLetterSourceQueuesCommand}.
 */
export interface ListDeadLetterSourceQueuesCommandOutput extends ListDeadLetterSourceQueuesResult, __MetadataBearer {
}
/**
 * @public
 * <p>Returns a list of your queues that have the <code>RedrivePolicy</code> queue attribute
 *             configured with a dead-letter queue.</p>
 *          <p> The <code>ListDeadLetterSourceQueues</code> methods supports pagination. Set
 *             parameter <code>MaxResults</code> in the request to specify the maximum number of
 *             results to be returned in the response. If you do not set <code>MaxResults</code>, the
 *             response includes a maximum of 1,000 results. If you set <code>MaxResults</code> and
 *             there are additional results to display, the response includes a value for
 *                 <code>NextToken</code>. Use <code>NextToken</code> as a parameter in your next
 *             request to <code>ListDeadLetterSourceQueues</code> to receive the next page of results. </p>
 *          <p>For more information about using dead-letter queues, see <a href="https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html">Using Amazon SQS Dead-Letter Queues</a> in the <i>Amazon SQS Developer
 *                 Guide</i>.</p>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { SQSClient, ListDeadLetterSourceQueuesCommand } from "@aws-sdk/client-sqs"; // ES Modules import
 * // const { SQSClient, ListDeadLetterSourceQueuesCommand } = require("@aws-sdk/client-sqs"); // CommonJS import
 * const client = new SQSClient(config);
 * const input = { // ListDeadLetterSourceQueuesRequest
 *   QueueUrl: "STRING_VALUE", // required
 *   NextToken: "STRING_VALUE",
 *   MaxResults: Number("int"),
 * };
 * const command = new ListDeadLetterSourceQueuesCommand(input);
 * const response = await client.send(command);
 * // { // ListDeadLetterSourceQueuesResult
 * //   queueUrls: [ // QueueUrlList // required
 * //     "STRING_VALUE",
 * //   ],
 * //   NextToken: "STRING_VALUE",
 * // };
 *
 * ```
 *
 * @param ListDeadLetterSourceQueuesCommandInput - {@link ListDeadLetterSourceQueuesCommandInput}
 * @returns {@link ListDeadLetterSourceQueuesCommandOutput}
 * @see {@link ListDeadLetterSourceQueuesCommandInput} for command's `input` shape.
 * @see {@link ListDeadLetterSourceQueuesCommandOutput} for command's `response` shape.
 * @see {@link SQSClientResolvedConfig | config} for SQSClient's `config` shape.
 *
 * @throws {@link QueueDoesNotExist} (client fault)
 *  <p>The specified queue doesn't exist.</p>
 *
 * @throws {@link SQSServiceException}
 * <p>Base exception class for all service exceptions from SQS service.</p>
 *
 */
export declare class ListDeadLetterSourceQueuesCommand extends $Command<ListDeadLetterSourceQueuesCommandInput, ListDeadLetterSourceQueuesCommandOutput, SQSClientResolvedConfig> {
    readonly input: ListDeadLetterSourceQueuesCommandInput;
    static getEndpointParameterInstructions(): EndpointParameterInstructions;
    /**
     * @public
     */
    constructor(input: ListDeadLetterSourceQueuesCommandInput);
    /**
     * @internal
     */
    resolveMiddleware(clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>, configuration: SQSClientResolvedConfig, options?: __HttpHandlerOptions): Handler<ListDeadLetterSourceQueuesCommandInput, ListDeadLetterSourceQueuesCommandOutput>;
    /**
     * @internal
     */
    private serialize;
    /**
     * @internal
     */
    private deserialize;
}
