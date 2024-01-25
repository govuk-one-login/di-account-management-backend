import { EndpointParameterInstructions } from "@smithy/middleware-endpoint";
import { Command as $Command } from "@smithy/smithy-client";
import {
  Handler,
  HttpHandlerOptions as __HttpHandlerOptions,
  MetadataBearer as __MetadataBearer,
  MiddlewareStack,
} from "@smithy/types";
import { PurgeQueueRequest } from "../models/models_0";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SQSClientResolvedConfig,
} from "../SQSClient";
export { __MetadataBearer, $Command };
export interface PurgeQueueCommandInput extends PurgeQueueRequest {}
export interface PurgeQueueCommandOutput extends __MetadataBearer {}
export declare class PurgeQueueCommand extends $Command<
  PurgeQueueCommandInput,
  PurgeQueueCommandOutput,
  SQSClientResolvedConfig
> {
  readonly input: PurgeQueueCommandInput;
  static getEndpointParameterInstructions(): EndpointParameterInstructions;
  constructor(input: PurgeQueueCommandInput);
  resolveMiddleware(
    clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>,
    configuration: SQSClientResolvedConfig,
    options?: __HttpHandlerOptions
  ): Handler<PurgeQueueCommandInput, PurgeQueueCommandOutput>;
  private serialize;
  private deserialize;
}
