import { EndpointParameterInstructions } from "@smithy/middleware-endpoint";
import { Command as $Command } from "@smithy/smithy-client";
import {
  Handler,
  HttpHandlerOptions as __HttpHandlerOptions,
  MetadataBearer as __MetadataBearer,
  MiddlewareStack,
} from "@smithy/types";
import { ChangeMessageVisibilityRequest } from "../models/models_0";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SQSClientResolvedConfig,
} from "../SQSClient";
export { __MetadataBearer, $Command };
export interface ChangeMessageVisibilityCommandInput
  extends ChangeMessageVisibilityRequest {}
export interface ChangeMessageVisibilityCommandOutput
  extends __MetadataBearer {}
export declare class ChangeMessageVisibilityCommand extends $Command<
  ChangeMessageVisibilityCommandInput,
  ChangeMessageVisibilityCommandOutput,
  SQSClientResolvedConfig
> {
  readonly input: ChangeMessageVisibilityCommandInput;
  static getEndpointParameterInstructions(): EndpointParameterInstructions;
  constructor(input: ChangeMessageVisibilityCommandInput);
  resolveMiddleware(
    clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>,
    configuration: SQSClientResolvedConfig,
    options?: __HttpHandlerOptions
  ): Handler<
    ChangeMessageVisibilityCommandInput,
    ChangeMessageVisibilityCommandOutput
  >;
  private serialize;
  private deserialize;
}
