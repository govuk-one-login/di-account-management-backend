import { EndpointParameterInstructions } from "@smithy/middleware-endpoint";
import { Command as $Command } from "@smithy/smithy-client";
import {
  Handler,
  HttpHandlerOptions as __HttpHandlerOptions,
  MetadataBearer as __MetadataBearer,
  MiddlewareStack,
} from "@smithy/types";
import {
  CancelMessageMoveTaskRequest,
  CancelMessageMoveTaskResult,
} from "../models/models_0";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SQSClientResolvedConfig,
} from "../SQSClient";
export { __MetadataBearer, $Command };
export interface CancelMessageMoveTaskCommandInput
  extends CancelMessageMoveTaskRequest {}
export interface CancelMessageMoveTaskCommandOutput
  extends CancelMessageMoveTaskResult,
    __MetadataBearer {}
export declare class CancelMessageMoveTaskCommand extends $Command<
  CancelMessageMoveTaskCommandInput,
  CancelMessageMoveTaskCommandOutput,
  SQSClientResolvedConfig
> {
  readonly input: CancelMessageMoveTaskCommandInput;
  static getEndpointParameterInstructions(): EndpointParameterInstructions;
  constructor(input: CancelMessageMoveTaskCommandInput);
  resolveMiddleware(
    clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>,
    configuration: SQSClientResolvedConfig,
    options?: __HttpHandlerOptions
  ): Handler<
    CancelMessageMoveTaskCommandInput,
    CancelMessageMoveTaskCommandOutput
  >;
  private serialize;
  private deserialize;
}
