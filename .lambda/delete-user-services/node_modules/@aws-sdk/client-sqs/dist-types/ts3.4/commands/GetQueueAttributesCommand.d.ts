import { EndpointParameterInstructions } from "@smithy/middleware-endpoint";
import { Command as $Command } from "@smithy/smithy-client";
import {
  Handler,
  HttpHandlerOptions as __HttpHandlerOptions,
  MetadataBearer as __MetadataBearer,
  MiddlewareStack,
} from "@smithy/types";
import {
  GetQueueAttributesRequest,
  GetQueueAttributesResult,
} from "../models/models_0";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SQSClientResolvedConfig,
} from "../SQSClient";
export { __MetadataBearer, $Command };
export interface GetQueueAttributesCommandInput
  extends GetQueueAttributesRequest {}
export interface GetQueueAttributesCommandOutput
  extends GetQueueAttributesResult,
    __MetadataBearer {}
export declare class GetQueueAttributesCommand extends $Command<
  GetQueueAttributesCommandInput,
  GetQueueAttributesCommandOutput,
  SQSClientResolvedConfig
> {
  readonly input: GetQueueAttributesCommandInput;
  static getEndpointParameterInstructions(): EndpointParameterInstructions;
  constructor(input: GetQueueAttributesCommandInput);
  resolveMiddleware(
    clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>,
    configuration: SQSClientResolvedConfig,
    options?: __HttpHandlerOptions
  ): Handler<GetQueueAttributesCommandInput, GetQueueAttributesCommandOutput>;
  private serialize;
  private deserialize;
}
