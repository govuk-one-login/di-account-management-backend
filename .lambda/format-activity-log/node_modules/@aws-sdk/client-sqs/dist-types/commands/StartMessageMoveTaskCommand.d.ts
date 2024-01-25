import { EndpointParameterInstructions } from "@smithy/middleware-endpoint";
import { Command as $Command } from "@smithy/smithy-client";
import { Handler, HttpHandlerOptions as __HttpHandlerOptions, MetadataBearer as __MetadataBearer, MiddlewareStack } from "@smithy/types";
import { StartMessageMoveTaskRequest, StartMessageMoveTaskResult } from "../models/models_0";
import { ServiceInputTypes, ServiceOutputTypes, SQSClientResolvedConfig } from "../SQSClient";
/**
 * @public
 */
export { __MetadataBearer, $Command };
/**
 * @public
 *
 * The input for {@link StartMessageMoveTaskCommand}.
 */
export interface StartMessageMoveTaskCommandInput extends StartMessageMoveTaskRequest {
}
/**
 * @public
 *
 * The output of {@link StartMessageMoveTaskCommand}.
 */
export interface StartMessageMoveTaskCommandOutput extends StartMessageMoveTaskResult, __MetadataBearer {
}
/**
 * @public
 * <p>Starts an asynchronous task to move messages from a specified source queue to a
 *             specified destination queue.</p>
 *          <note>
 *             <ul>
 *                <li>
 *                   <p>This action is currently limited to supporting message redrive from queues
 *                         that are configured as <a href="https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html">dead-letter queues (DLQs)</a> of other Amazon SQS queues only. Non-SQS
 *                         queue sources of dead-letter queues, such as Lambda or Amazon SNS topics, are
 *                         currently not supported.</p>
 *                </li>
 *                <li>
 *                   <p>In dead-letter queues redrive context, the
 *                             <code>StartMessageMoveTask</code> the source queue is the DLQ, while the
 *                         destination queue can be the original source queue (from which the messages
 *                         were driven to the dead-letter-queue), or a custom destination queue.</p>
 *                </li>
 *                <li>
 *                   <p>Currently, only standard queues support redrive. FIFO queues don't support
 *                         redrive.</p>
 *                </li>
 *                <li>
 *                   <p>Only one active message movement task is supported per queue at any given
 *                         time.</p>
 *                </li>
 *             </ul>
 *          </note>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { SQSClient, StartMessageMoveTaskCommand } from "@aws-sdk/client-sqs"; // ES Modules import
 * // const { SQSClient, StartMessageMoveTaskCommand } = require("@aws-sdk/client-sqs"); // CommonJS import
 * const client = new SQSClient(config);
 * const input = { // StartMessageMoveTaskRequest
 *   SourceArn: "STRING_VALUE", // required
 *   DestinationArn: "STRING_VALUE",
 *   MaxNumberOfMessagesPerSecond: Number("int"),
 * };
 * const command = new StartMessageMoveTaskCommand(input);
 * const response = await client.send(command);
 * // { // StartMessageMoveTaskResult
 * //   TaskHandle: "STRING_VALUE",
 * // };
 *
 * ```
 *
 * @param StartMessageMoveTaskCommandInput - {@link StartMessageMoveTaskCommandInput}
 * @returns {@link StartMessageMoveTaskCommandOutput}
 * @see {@link StartMessageMoveTaskCommandInput} for command's `input` shape.
 * @see {@link StartMessageMoveTaskCommandOutput} for command's `response` shape.
 * @see {@link SQSClientResolvedConfig | config} for SQSClient's `config` shape.
 *
 * @throws {@link ResourceNotFoundException} (client fault)
 *  <p>One or more specified resources don't exist.</p>
 *
 * @throws {@link UnsupportedOperation} (client fault)
 *  <p>Error code 400. Unsupported operation.</p>
 *
 * @throws {@link SQSServiceException}
 * <p>Base exception class for all service exceptions from SQS service.</p>
 *
 */
export declare class StartMessageMoveTaskCommand extends $Command<StartMessageMoveTaskCommandInput, StartMessageMoveTaskCommandOutput, SQSClientResolvedConfig> {
    readonly input: StartMessageMoveTaskCommandInput;
    static getEndpointParameterInstructions(): EndpointParameterInstructions;
    /**
     * @public
     */
    constructor(input: StartMessageMoveTaskCommandInput);
    /**
     * @internal
     */
    resolveMiddleware(clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>, configuration: SQSClientResolvedConfig, options?: __HttpHandlerOptions): Handler<StartMessageMoveTaskCommandInput, StartMessageMoveTaskCommandOutput>;
    /**
     * @internal
     */
    private serialize;
    /**
     * @internal
     */
    private deserialize;
}
