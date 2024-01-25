import { EndpointParameterInstructions } from "@smithy/middleware-endpoint";
import { Command as $Command } from "@smithy/smithy-client";
import {
  Handler,
  HttpHandlerOptions as __HttpHandlerOptions,
  MetadataBearer as __MetadataBearer,
  MiddlewareStack,
} from "@smithy/types";
import {
  ListMessageMoveTasksRequest,
  ListMessageMoveTasksResult,
} from "../models/models_0";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SQSClientResolvedConfig,
} from "../SQSClient";
export { __MetadataBearer, $Command };
export interface ListMessageMoveTasksCommandInput
  extends ListMessageMoveTasksRequest {}
export interface ListMessageMoveTasksCommandOutput
  extends ListMessageMoveTasksResult,
    __MetadataBearer {}
export declare class ListMessageMoveTasksCommand extends $Command<
  ListMessageMoveTasksCommandInput,
  ListMessageMoveTasksCommandOutput,
  SQSClientResolvedConfig
> {
  readonly input: ListMessageMoveTasksCommandInput;
  static getEndpointParameterInstructions(): EndpointParameterInstructions;
  constructor(input: ListMessageMoveTasksCommandInput);
  resolveMiddleware(
    clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>,
    configuration: SQSClientResolvedConfig,
    options?: __HttpHandlerOptions
  ): Handler<
    ListMessageMoveTasksCommandInput,
    ListMessageMoveTasksCommandOutput
  >;
  private serialize;
  private deserialize;
}
