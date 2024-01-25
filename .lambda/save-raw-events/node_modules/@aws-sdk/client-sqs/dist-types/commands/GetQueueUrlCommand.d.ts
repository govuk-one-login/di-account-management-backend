import { EndpointParameterInstructions } from "@smithy/middleware-endpoint";
import { Command as $Command } from "@smithy/smithy-client";
import { Handler, HttpHandlerOptions as __HttpHandlerOptions, MetadataBearer as __MetadataBearer, MiddlewareStack } from "@smithy/types";
import { GetQueueUrlRequest, GetQueueUrlResult } from "../models/models_0";
import { ServiceInputTypes, ServiceOutputTypes, SQSClientResolvedConfig } from "../SQSClient";
/**
 * @public
 */
export { __MetadataBearer, $Command };
/**
 * @public
 *
 * The input for {@link GetQueueUrlCommand}.
 */
export interface GetQueueUrlCommandInput extends GetQueueUrlRequest {
}
/**
 * @public
 *
 * The output of {@link GetQueueUrlCommand}.
 */
export interface GetQueueUrlCommandOutput extends GetQueueUrlResult, __MetadataBearer {
}
/**
 * @public
 * <p>Returns the URL of an existing Amazon SQS queue.</p>
 *          <p>To access a queue that belongs to another AWS account, use the
 *                 <code>QueueOwnerAWSAccountId</code> parameter to specify the account ID of the
 *             queue's owner. The queue's owner must grant you permission to access the queue. For more
 *             information about shared queue access, see <code>
 *                <a>AddPermission</a>
 *             </code>
 *             or see <a href="https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-writing-an-sqs-policy.html#write-messages-to-shared-queue">Allow Developers to Write Messages to a Shared Queue</a> in the <i>Amazon SQS
 *                 Developer Guide</i>. </p>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { SQSClient, GetQueueUrlCommand } from "@aws-sdk/client-sqs"; // ES Modules import
 * // const { SQSClient, GetQueueUrlCommand } = require("@aws-sdk/client-sqs"); // CommonJS import
 * const client = new SQSClient(config);
 * const input = { // GetQueueUrlRequest
 *   QueueName: "STRING_VALUE", // required
 *   QueueOwnerAWSAccountId: "STRING_VALUE",
 * };
 * const command = new GetQueueUrlCommand(input);
 * const response = await client.send(command);
 * // { // GetQueueUrlResult
 * //   QueueUrl: "STRING_VALUE",
 * // };
 *
 * ```
 *
 * @param GetQueueUrlCommandInput - {@link GetQueueUrlCommandInput}
 * @returns {@link GetQueueUrlCommandOutput}
 * @see {@link GetQueueUrlCommandInput} for command's `input` shape.
 * @see {@link GetQueueUrlCommandOutput} for command's `response` shape.
 * @see {@link SQSClientResolvedConfig | config} for SQSClient's `config` shape.
 *
 * @throws {@link QueueDoesNotExist} (client fault)
 *  <p>The specified queue doesn't exist.</p>
 *
 * @throws {@link SQSServiceException}
 * <p>Base exception class for all service exceptions from SQS service.</p>
 *
 */
export declare class GetQueueUrlCommand extends $Command<GetQueueUrlCommandInput, GetQueueUrlCommandOutput, SQSClientResolvedConfig> {
    readonly input: GetQueueUrlCommandInput;
    static getEndpointParameterInstructions(): EndpointParameterInstructions;
    /**
     * @public
     */
    constructor(input: GetQueueUrlCommandInput);
    /**
     * @internal
     */
    resolveMiddleware(clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>, configuration: SQSClientResolvedConfig, options?: __HttpHandlerOptions): Handler<GetQueueUrlCommandInput, GetQueueUrlCommandOutput>;
    /**
     * @internal
     */
    private serialize;
    /**
     * @internal
     */
    private deserialize;
}
