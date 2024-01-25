import { EndpointParameterInstructions } from "@smithy/middleware-endpoint";
import { Command as $Command } from "@smithy/smithy-client";
import {
  Handler,
  HttpHandlerOptions as __HttpHandlerOptions,
  MetadataBearer as __MetadataBearer,
  MiddlewareStack,
} from "@smithy/types";
import { AddPermissionRequest } from "../models/models_0";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SQSClientResolvedConfig,
} from "../SQSClient";
export { __MetadataBearer, $Command };
export interface AddPermissionCommandInput extends AddPermissionRequest {}
export interface AddPermissionCommandOutput extends __MetadataBearer {}
export declare class AddPermissionCommand extends $Command<
  AddPermissionCommandInput,
  AddPermissionCommandOutput,
  SQSClientResolvedConfig
> {
  readonly input: AddPermissionCommandInput;
  static getEndpointParameterInstructions(): EndpointParameterInstructions;
  constructor(input: AddPermissionCommandInput);
  resolveMiddleware(
    clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>,
    configuration: SQSClientResolvedConfig,
    options?: __HttpHandlerOptions
  ): Handler<AddPermissionCommandInput, AddPermissionCommandOutput>;
  private serialize;
  private deserialize;
}
