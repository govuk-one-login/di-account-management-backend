import { EndpointParameterInstructions } from "@smithy/middleware-endpoint";
import { Command as $Command } from "@smithy/smithy-client";
import {
  Handler,
  HttpHandlerOptions as __HttpHandlerOptions,
  MetadataBearer as __MetadataBearer,
  MiddlewareStack,
} from "@smithy/types";
import { ListQueueTagsRequest, ListQueueTagsResult } from "../models/models_0";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SQSClientResolvedConfig,
} from "../SQSClient";
export { __MetadataBearer, $Command };
export interface ListQueueTagsCommandInput extends ListQueueTagsRequest {}
export interface ListQueueTagsCommandOutput
  extends ListQueueTagsResult,
    __MetadataBearer {}
export declare class ListQueueTagsCommand extends $Command<
  ListQueueTagsCommandInput,
  ListQueueTagsCommandOutput,
  SQSClientResolvedConfig
> {
  readonly input: ListQueueTagsCommandInput;
  static getEndpointParameterInstructions(): EndpointParameterInstructions;
  constructor(input: ListQueueTagsCommandInput);
  resolveMiddleware(
    clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>,
    configuration: SQSClientResolvedConfig,
    options?: __HttpHandlerOptions
  ): Handler<ListQueueTagsCommandInput, ListQueueTagsCommandOutput>;
  private serialize;
  private deserialize;
}
