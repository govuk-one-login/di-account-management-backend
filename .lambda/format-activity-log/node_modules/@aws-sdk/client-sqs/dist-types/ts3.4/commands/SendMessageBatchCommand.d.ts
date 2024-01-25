import { EndpointParameterInstructions } from "@smithy/middleware-endpoint";
import { Command as $Command } from "@smithy/smithy-client";
import {
  Handler,
  HttpHandlerOptions as __HttpHandlerOptions,
  MetadataBearer as __MetadataBearer,
  MiddlewareStack,
} from "@smithy/types";
import {
  SendMessageBatchRequest,
  SendMessageBatchResult,
} from "../models/models_0";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SQSClientResolvedConfig,
} from "../SQSClient";
export { __MetadataBearer, $Command };
export interface SendMessageBatchCommandInput extends SendMessageBatchRequest {}
export interface SendMessageBatchCommandOutput
  extends SendMessageBatchResult,
    __MetadataBearer {}
export declare class SendMessageBatchCommand extends $Command<
  SendMessageBatchCommandInput,
  SendMessageBatchCommandOutput,
  SQSClientResolvedConfig
> {
  readonly input: SendMessageBatchCommandInput;
  static getEndpointParameterInstructions(): EndpointParameterInstructions;
  constructor(input: SendMessageBatchCommandInput);
  resolveMiddleware(
    clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>,
    configuration: SQSClientResolvedConfig,
    options?: __HttpHandlerOptions
  ): Handler<SendMessageBatchCommandInput, SendMessageBatchCommandOutput>;
  private serialize;
  private deserialize;
}
