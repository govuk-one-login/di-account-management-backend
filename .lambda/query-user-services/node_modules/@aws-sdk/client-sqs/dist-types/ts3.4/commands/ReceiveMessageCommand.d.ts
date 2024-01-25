import { EndpointParameterInstructions } from "@smithy/middleware-endpoint";
import { Command as $Command } from "@smithy/smithy-client";
import {
  Handler,
  HttpHandlerOptions as __HttpHandlerOptions,
  MetadataBearer as __MetadataBearer,
  MiddlewareStack,
} from "@smithy/types";
import {
  ReceiveMessageRequest,
  ReceiveMessageResult,
} from "../models/models_0";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SQSClientResolvedConfig,
} from "../SQSClient";
export { __MetadataBearer, $Command };
export interface ReceiveMessageCommandInput extends ReceiveMessageRequest {}
export interface ReceiveMessageCommandOutput
  extends ReceiveMessageResult,
    __MetadataBearer {}
export declare class ReceiveMessageCommand extends $Command<
  ReceiveMessageCommandInput,
  ReceiveMessageCommandOutput,
  SQSClientResolvedConfig
> {
  readonly input: ReceiveMessageCommandInput;
  static getEndpointParameterInstructions(): EndpointParameterInstructions;
  constructor(input: ReceiveMessageCommandInput);
  resolveMiddleware(
    clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>,
    configuration: SQSClientResolvedConfig,
    options?: __HttpHandlerOptions
  ): Handler<ReceiveMessageCommandInput, ReceiveMessageCommandOutput>;
  private serialize;
  private deserialize;
}
