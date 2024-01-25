import { EndpointParameterInstructions } from "@smithy/middleware-endpoint";
import { Command as $Command } from "@smithy/smithy-client";
import {
  Handler,
  HttpHandlerOptions as __HttpHandlerOptions,
  MetadataBearer as __MetadataBearer,
  MiddlewareStack,
} from "@smithy/types";
import { GetQueueUrlRequest, GetQueueUrlResult } from "../models/models_0";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SQSClientResolvedConfig,
} from "../SQSClient";
export { __MetadataBearer, $Command };
export interface GetQueueUrlCommandInput extends GetQueueUrlRequest {}
export interface GetQueueUrlCommandOutput
  extends GetQueueUrlResult,
    __MetadataBearer {}
export declare class GetQueueUrlCommand extends $Command<
  GetQueueUrlCommandInput,
  GetQueueUrlCommandOutput,
  SQSClientResolvedConfig
> {
  readonly input: GetQueueUrlCommandInput;
  static getEndpointParameterInstructions(): EndpointParameterInstructions;
  constructor(input: GetQueueUrlCommandInput);
  resolveMiddleware(
    clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>,
    configuration: SQSClientResolvedConfig,
    options?: __HttpHandlerOptions
  ): Handler<GetQueueUrlCommandInput, GetQueueUrlCommandOutput>;
  private serialize;
  private deserialize;
}
