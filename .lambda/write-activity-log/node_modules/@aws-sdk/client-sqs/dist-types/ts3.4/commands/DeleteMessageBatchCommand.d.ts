import { EndpointParameterInstructions } from "@smithy/middleware-endpoint";
import { Command as $Command } from "@smithy/smithy-client";
import {
  Handler,
  HttpHandlerOptions as __HttpHandlerOptions,
  MetadataBearer as __MetadataBearer,
  MiddlewareStack,
} from "@smithy/types";
import {
  DeleteMessageBatchRequest,
  DeleteMessageBatchResult,
} from "../models/models_0";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SQSClientResolvedConfig,
} from "../SQSClient";
export { __MetadataBearer, $Command };
export interface DeleteMessageBatchCommandInput
  extends DeleteMessageBatchRequest {}
export interface DeleteMessageBatchCommandOutput
  extends DeleteMessageBatchResult,
    __MetadataBearer {}
export declare class DeleteMessageBatchCommand extends $Command<
  DeleteMessageBatchCommandInput,
  DeleteMessageBatchCommandOutput,
  SQSClientResolvedConfig
> {
  readonly input: DeleteMessageBatchCommandInput;
  static getEndpointParameterInstructions(): EndpointParameterInstructions;
  constructor(input: DeleteMessageBatchCommandInput);
  resolveMiddleware(
    clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>,
    configuration: SQSClientResolvedConfig,
    options?: __HttpHandlerOptions
  ): Handler<DeleteMessageBatchCommandInput, DeleteMessageBatchCommandOutput>;
  private serialize;
  private deserialize;
}
