import { EndpointParameterInstructions } from "@smithy/middleware-endpoint";
import { Command as $Command } from "@smithy/smithy-client";
import {
  Handler,
  HttpHandlerOptions as __HttpHandlerOptions,
  MetadataBearer as __MetadataBearer,
  MiddlewareStack,
} from "@smithy/types";
import {
  StartMessageMoveTaskRequest,
  StartMessageMoveTaskResult,
} from "../models/models_0";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SQSClientResolvedConfig,
} from "../SQSClient";
export { __MetadataBearer, $Command };
export interface StartMessageMoveTaskCommandInput
  extends StartMessageMoveTaskRequest {}
export interface StartMessageMoveTaskCommandOutput
  extends StartMessageMoveTaskResult,
    __MetadataBearer {}
export declare class StartMessageMoveTaskCommand extends $Command<
  StartMessageMoveTaskCommandInput,
  StartMessageMoveTaskCommandOutput,
  SQSClientResolvedConfig
> {
  readonly input: StartMessageMoveTaskCommandInput;
  static getEndpointParameterInstructions(): EndpointParameterInstructions;
  constructor(input: StartMessageMoveTaskCommandInput);
  resolveMiddleware(
    clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>,
    configuration: SQSClientResolvedConfig,
    options?: __HttpHandlerOptions
  ): Handler<
    StartMessageMoveTaskCommandInput,
    StartMessageMoveTaskCommandOutput
  >;
  private serialize;
  private deserialize;
}
