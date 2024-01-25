import { EndpointParameterInstructions } from "@smithy/middleware-endpoint";
import { Command as $Command } from "@smithy/smithy-client";
import {
  Handler,
  HttpHandlerOptions as __HttpHandlerOptions,
  MetadataBearer as __MetadataBearer,
  MiddlewareStack,
} from "@smithy/types";
import { CreateQueueRequest, CreateQueueResult } from "../models/models_0";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SQSClientResolvedConfig,
} from "../SQSClient";
export { __MetadataBearer, $Command };
export interface CreateQueueCommandInput extends CreateQueueRequest {}
export interface CreateQueueCommandOutput
  extends CreateQueueResult,
    __MetadataBearer {}
export declare class CreateQueueCommand extends $Command<
  CreateQueueCommandInput,
  CreateQueueCommandOutput,
  SQSClientResolvedConfig
> {
  readonly input: CreateQueueCommandInput;
  static getEndpointParameterInstructions(): EndpointParameterInstructions;
  constructor(input: CreateQueueCommandInput);
  resolveMiddleware(
    clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>,
    configuration: SQSClientResolvedConfig,
    options?: __HttpHandlerOptions
  ): Handler<CreateQueueCommandInput, CreateQueueCommandOutput>;
  private serialize;
  private deserialize;
}
