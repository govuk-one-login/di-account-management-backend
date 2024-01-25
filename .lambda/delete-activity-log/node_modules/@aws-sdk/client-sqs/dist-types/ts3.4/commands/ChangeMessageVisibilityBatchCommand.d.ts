import { EndpointParameterInstructions } from "@smithy/middleware-endpoint";
import { Command as $Command } from "@smithy/smithy-client";
import {
  Handler,
  HttpHandlerOptions as __HttpHandlerOptions,
  MetadataBearer as __MetadataBearer,
  MiddlewareStack,
} from "@smithy/types";
import {
  ChangeMessageVisibilityBatchRequest,
  ChangeMessageVisibilityBatchResult,
} from "../models/models_0";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SQSClientResolvedConfig,
} from "../SQSClient";
export { __MetadataBearer, $Command };
export interface ChangeMessageVisibilityBatchCommandInput
  extends ChangeMessageVisibilityBatchRequest {}
export interface ChangeMessageVisibilityBatchCommandOutput
  extends ChangeMessageVisibilityBatchResult,
    __MetadataBearer {}
export declare class ChangeMessageVisibilityBatchCommand extends $Command<
  ChangeMessageVisibilityBatchCommandInput,
  ChangeMessageVisibilityBatchCommandOutput,
  SQSClientResolvedConfig
> {
  readonly input: ChangeMessageVisibilityBatchCommandInput;
  static getEndpointParameterInstructions(): EndpointParameterInstructions;
  constructor(input: ChangeMessageVisibilityBatchCommandInput);
  resolveMiddleware(
    clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>,
    configuration: SQSClientResolvedConfig,
    options?: __HttpHandlerOptions
  ): Handler<
    ChangeMessageVisibilityBatchCommandInput,
    ChangeMessageVisibilityBatchCommandOutput
  >;
  private serialize;
  private deserialize;
}
