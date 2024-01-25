import { EndpointParameterInstructions } from "@smithy/middleware-endpoint";
import { Command as $Command } from "@smithy/smithy-client";
import {
  Handler,
  HttpHandlerOptions as __HttpHandlerOptions,
  MetadataBearer as __MetadataBearer,
  MiddlewareStack,
} from "@smithy/types";
import { SetQueueAttributesRequest } from "../models/models_0";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SQSClientResolvedConfig,
} from "../SQSClient";
export { __MetadataBearer, $Command };
export interface SetQueueAttributesCommandInput
  extends SetQueueAttributesRequest {}
export interface SetQueueAttributesCommandOutput extends __MetadataBearer {}
export declare class SetQueueAttributesCommand extends $Command<
  SetQueueAttributesCommandInput,
  SetQueueAttributesCommandOutput,
  SQSClientResolvedConfig
> {
  readonly input: SetQueueAttributesCommandInput;
  static getEndpointParameterInstructions(): EndpointParameterInstructions;
  constructor(input: SetQueueAttributesCommandInput);
  resolveMiddleware(
    clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>,
    configuration: SQSClientResolvedConfig,
    options?: __HttpHandlerOptions
  ): Handler<SetQueueAttributesCommandInput, SetQueueAttributesCommandOutput>;
  private serialize;
  private deserialize;
}
