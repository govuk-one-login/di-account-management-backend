// Minimal reader for template.yaml. It only extracts what the local tooling
// needs (tables, queues and function handlers/env names), it does not try to
// evaluate CloudFormation intrinsic functions.
//
// CloudFormation short-form tags (!Ref, !Sub, ...) are not known to the YAML
// parser, which then returns the tagged value untagged. So `!Ref FooTableName`
// is read as the string "FooTableName" and `!Sub "${AWS::StackName}-x"` as the
// string "${AWS::StackName}-x".

import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { STACK_NAME, TEMPLATE_PATH } from "./config.ts";

type Json = unknown;
type JsonMap = Record<string, Json>;

export interface StreamTrigger {
  /** Logical id of the table whose stream triggers the function. */
  tableLogicalId: string;
  batchSize: number;
  /** FilterCriteria patterns (JSON). A record matches if any pattern does. */
  filterPatterns: string[];
  reportBatchItemFailures: boolean;
}

interface TemplateFunction {
  logicalId: string;
  /** Handler without the trailing ".handler" e.g. "analyse-activity-log/handler" */
  handlerFile: string;
  /** Exported function name, e.g. "handler" */
  handlerExport: string;
  /** Names of the env vars set on the function itself (not via Globals). */
  envKeys: string[];
  /** DynamoDB stream event sources. */
  streamTriggers: StreamTrigger[];
}

export interface TemplateTable {
  logicalId: string;
  tableName: string;
  attributeDefinitions: { AttributeName: string; AttributeType: string }[];
  keySchema: { AttributeName: string; KeyType: string }[];
  globalSecondaryIndexes: {
    indexName: string;
    keySchema: { AttributeName: string; KeyType: string }[];
  }[];
  ttlAttribute?: string;
  /** Set when the table has a StreamSpecification. */
  streamViewType?: string;
}

export interface ParsedTemplate {
  functions: TemplateFunction[];
  tables: TemplateTable[];
  queueLogicalIds: string[];
}

const asMap = (value: Json): JsonMap =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonMap)
    : {};

const asArray = (value: Json): Json[] => (Array.isArray(value) ? value : []);

const parameterDefaults = (template: JsonMap): Record<string, string> => {
  const defaults: Record<string, string> = {};
  for (const [name, definition] of Object.entries(asMap(template.Parameters))) {
    const value = asMap(definition).Default;
    if (typeof value === "string") defaults[name] = value;
  }
  return defaults;
};

/**
 * Resolves a `!Ref Parameter` or `!Sub "${AWS::StackName}-..."` value to a
 * plain string, or undefined when it can't be resolved without evaluating
 * the template.
 */
const resolveName = (
  value: Json,
  parameters: Record<string, string>
): string | undefined => {
  if (typeof value !== "string") return undefined;
  if (value in parameters) return parameters[value];
  const substituted = value.replaceAll("${AWS::StackName}", STACK_NAME);
  return substituted.includes("${") ? undefined : substituted;
};

const readKeySchema = (value: Json) =>
  asArray(value).map((entry) => {
    const { AttributeName, KeyType } = asMap(entry);
    return { AttributeName: String(AttributeName), KeyType: String(KeyType) };
  });

const readTable = (
  logicalId: string,
  properties: JsonMap,
  parameters: Record<string, string>
): TemplateTable | undefined => {
  const tableName = resolveName(properties.TableName, parameters);
  if (tableName === undefined) return undefined;

  const ttl = asMap(properties.TimeToLiveSpecification);
  const streamSpecification = asMap(properties.StreamSpecification);

  return {
    logicalId,
    tableName,
    attributeDefinitions: asArray(properties.AttributeDefinitions).map(
      (entry) => {
        const { AttributeName, AttributeType } = asMap(entry);
        return {
          AttributeName: String(AttributeName),
          AttributeType: String(AttributeType),
        };
      }
    ),
    keySchema: readKeySchema(properties.KeySchema),
    globalSecondaryIndexes: asArray(properties.GlobalSecondaryIndexes).map(
      (index) => {
        const gsi = asMap(index);
        return {
          indexName: resolveName(gsi.IndexName, parameters) ?? "",
          keySchema: readKeySchema(gsi.KeySchema),
        };
      }
    ),
    ...(typeof ttl.AttributeName === "string" && {
      ttlAttribute: ttl.AttributeName,
    }),
    ...(typeof streamSpecification.StreamViewType === "string" && {
      streamViewType: streamSpecification.StreamViewType,
    }),
  };
};

/**
 * `Stream: !GetAtt RawEventsStore.StreamArn` is read as the string
 * "RawEventsStore.StreamArn".
 */
const readStreamTriggers = (properties: JsonMap): StreamTrigger[] =>
  Object.values(asMap(properties.Events)).flatMap((event) => {
    const { Type, Properties } = asMap(event);
    if (Type !== "DynamoDB") return [];
    const source = asMap(Properties);
    const stream = typeof source.Stream === "string" ? source.Stream : "";
    return [
      {
        tableLogicalId: stream.split(".")[0],
        batchSize:
          typeof source.BatchSize === "number" ? source.BatchSize : 100,
        filterPatterns: asArray(asMap(source.FilterCriteria).Filters).flatMap(
          (filter) => {
            const { Pattern } = asMap(filter);
            return typeof Pattern === "string" ? [Pattern] : [];
          }
        ),
        reportBatchItemFailures: asArray(source.FunctionResponseTypes).includes(
          "ReportBatchItemFailures"
        ),
      },
    ];
  });

export const parseTemplate = (source: string): ParsedTemplate => {
  // `logLevel: "error"` stops the parser warning about every !Ref/!Sub tag.
  const template = asMap(parse(source, { logLevel: "error" }));
  const parameters = parameterDefaults(template);

  const functions: TemplateFunction[] = [];
  const tables: TemplateTable[] = [];
  const queueLogicalIds: string[] = [];

  for (const [logicalId, resource] of Object.entries(
    asMap(template.Resources)
  )) {
    const { Type, Properties } = asMap(resource);
    const properties = asMap(Properties);

    if (Type === "AWS::Serverless::Function") {
      const handler = String(properties.Handler);
      const split = handler.lastIndexOf(".");
      functions.push({
        logicalId,
        handlerFile: handler.slice(0, split),
        handlerExport: handler.slice(split + 1),
        envKeys: Object.keys(asMap(asMap(properties.Environment).Variables)),
        streamTriggers: readStreamTriggers(properties),
      });
    } else if (Type === "AWS::DynamoDB::Table") {
      const table = readTable(logicalId, properties, parameters);
      if (table) tables.push(table);
    } else if (Type === "AWS::SQS::Queue") {
      queueLogicalIds.push(logicalId);
    }
  }

  return { functions, tables, queueLogicalIds };
};

export const loadTemplate = (path = TEMPLATE_PATH): ParsedTemplate =>
  parseTemplate(readFileSync(path, "utf8"));
