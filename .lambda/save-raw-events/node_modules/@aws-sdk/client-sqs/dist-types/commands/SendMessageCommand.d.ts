import { EndpointParameterInstructions } from "@smithy/middleware-endpoint";
import { Command as $Command } from "@smithy/smithy-client";
import { Handler, HttpHandlerOptions as __HttpHandlerOptions, MetadataBearer as __MetadataBearer, MiddlewareStack } from "@smithy/types";
import { SendMessageRequest, SendMessageResult } from "../models/models_0";
import { ServiceInputTypes, ServiceOutputTypes, SQSClientResolvedConfig } from "../SQSClient";
/**
 * @public
 */
export { __MetadataBearer, $Command };
/**
 * @public
 *
 * The input for {@link SendMessageCommand}.
 */
export interface SendMessageCommandInput extends SendMessageRequest {
}
/**
 * @public
 *
 * The output of {@link SendMessageCommand}.
 */
export interface SendMessageCommandOutput extends SendMessageResult, __MetadataBearer {
}
/**
 * @public
 * <p>Delivers a message to the specified queue.</p>
 *          <important>
 *             <p>A message can include only XML, JSON, and unformatted text. The following Unicode characters are allowed:</p>
 *             <p>
 *                <code>#x9</code> | <code>#xA</code> | <code>#xD</code> | <code>#x20</code> to <code>#xD7FF</code> | <code>#xE000</code> to <code>#xFFFD</code> | <code>#x10000</code> to <code>#x10FFFF</code>
 *             </p>
 *             <p>Any characters not included in this list will be rejected. For more information, see the <a href="http://www.w3.org/TR/REC-xml/#charsets">W3C specification for characters</a>.</p>
 *          </important>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs"; // ES Modules import
 * // const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs"); // CommonJS import
 * const client = new SQSClient(config);
 * const input = { // SendMessageRequest
 *   QueueUrl: "STRING_VALUE", // required
 *   MessageBody: "STRING_VALUE", // required
 *   DelaySeconds: Number("int"),
 *   MessageAttributes: { // MessageBodyAttributeMap
 *     "<keys>": { // MessageAttributeValue
 *       StringValue: "STRING_VALUE",
 *       BinaryValue: "BLOB_VALUE",
 *       StringListValues: [ // StringList
 *         "STRING_VALUE",
 *       ],
 *       BinaryListValues: [ // BinaryList
 *         "BLOB_VALUE",
 *       ],
 *       DataType: "STRING_VALUE", // required
 *     },
 *   },
 *   MessageSystemAttributes: { // MessageBodySystemAttributeMap
 *     "<keys>": { // MessageSystemAttributeValue
 *       StringValue: "STRING_VALUE",
 *       BinaryValue: "BLOB_VALUE",
 *       StringListValues: [
 *         "STRING_VALUE",
 *       ],
 *       BinaryListValues: [
 *         "BLOB_VALUE",
 *       ],
 *       DataType: "STRING_VALUE", // required
 *     },
 *   },
 *   MessageDeduplicationId: "STRING_VALUE",
 *   MessageGroupId: "STRING_VALUE",
 * };
 * const command = new SendMessageCommand(input);
 * const response = await client.send(command);
 * // { // SendMessageResult
 * //   MD5OfMessageBody: "STRING_VALUE",
 * //   MD5OfMessageAttributes: "STRING_VALUE",
 * //   MD5OfMessageSystemAttributes: "STRING_VALUE",
 * //   MessageId: "STRING_VALUE",
 * //   SequenceNumber: "STRING_VALUE",
 * // };
 *
 * ```
 *
 * @param SendMessageCommandInput - {@link SendMessageCommandInput}
 * @returns {@link SendMessageCommandOutput}
 * @see {@link SendMessageCommandInput} for command's `input` shape.
 * @see {@link SendMessageCommandOutput} for command's `response` shape.
 * @see {@link SQSClientResolvedConfig | config} for SQSClient's `config` shape.
 *
 * @throws {@link InvalidMessageContents} (client fault)
 *  <p>The message contains characters outside the allowed set.</p>
 *
 * @throws {@link UnsupportedOperation} (client fault)
 *  <p>Error code 400. Unsupported operation.</p>
 *
 * @throws {@link SQSServiceException}
 * <p>Base exception class for all service exceptions from SQS service.</p>
 *
 */
export declare class SendMessageCommand extends $Command<SendMessageCommandInput, SendMessageCommandOutput, SQSClientResolvedConfig> {
    readonly input: SendMessageCommandInput;
    static getEndpointParameterInstructions(): EndpointParameterInstructions;
    /**
     * @public
     */
    constructor(input: SendMessageCommandInput);
    /**
     * @internal
     */
    resolveMiddleware(clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>, configuration: SQSClientResolvedConfig, options?: __HttpHandlerOptions): Handler<SendMessageCommandInput, SendMessageCommandOutput>;
    /**
     * @internal
     */
    private serialize;
    /**
     * @internal
     */
    private deserialize;
}
