import { EndpointParameterInstructions } from "@smithy/middleware-endpoint";
import { Command as $Command } from "@smithy/smithy-client";
import {
  Handler,
  HttpHandlerOptions as __HttpHandlerOptions,
  MetadataBearer as __MetadataBearer,
  MiddlewareStack,
} from "@smithy/types";
import { TagQueueRequest } from "../models/models_0";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SQSClientResolvedConfig,
} from "../SQSClient";
export { __MetadataBearer, $Command };
export interface TagQueueCommandInput extends TagQueueRequest {}
export interface TagQueueCommandOutput extends __MetadataBearer {}
export declare class TagQueueCommand extends $Command<
  TagQueueCommandInput,
  TagQueueCommandOutput,
  SQSClientResolvedConfig
> {
  readonly input: TagQueueCommandInput;
  static getEndpointParameterInstructions(): EndpointParameterInstructions;
  constructor(input: TagQueueCommandInput);
  resolveMiddleware(
    clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>,
    configuration: SQSClientResolvedConfig,
    options?: __HttpHandlerOptions
  ): Handler<TagQueueCommandInput, TagQueueCommandOutput>;
  private serialize;
  private deserialize;
}
