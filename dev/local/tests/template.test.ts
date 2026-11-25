import { describe, expect, it } from "vitest";
import { tableInput } from "../bootstrap.ts";
import { loadTemplate, parseTemplate } from "../template.ts";

describe("parseTemplate", () => {
  it("reads functions, tables and queues, resolving parameter and stack-name names", () => {
    const parsed = parseTemplate(`
Parameters:
  FooTableName:
    Type: String
    Default: foo_table
Resources:
  Fn:
    Type: AWS::Serverless::Function
    Properties:
      Handler: dir/file.handler
      Environment:
        Variables:
          A: !Ref Something
          B: x
  FooTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: !Ref FooTableName
      AttributeDefinitions:
        - { AttributeName: id, AttributeType: S }
      KeySchema:
        - { AttributeName: id, KeyType: HASH }
      TimeToLiveSpecification:
        AttributeName: ttl
        Enabled: true
  StackTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: !Sub "\${AWS::StackName}-things"
      AttributeDefinitions:
        - { AttributeName: id, AttributeType: S }
      KeySchema:
        - { AttributeName: id, KeyType: HASH }
  UnnamedTable:
    Type: AWS::DynamoDB::Table
    Properties:
      AttributeDefinitions: []
      KeySchema: []
  Queue:
    Type: AWS::SQS::Queue
`);
    expect(parsed.functions).toEqual([
      {
        logicalId: "Fn",
        handlerFile: "dir/file",
        handlerExport: "handler",
        envKeys: ["A", "B"],
      },
    ]);
    expect(parsed.tables.map((t) => t.tableName)).toEqual([
      "foo_table",
      "home-backend-things",
    ]);
    expect(parsed.tables[0].ttlAttribute).toBe("ttl");
    expect(parsed.queueLogicalIds).toEqual(["Queue"]);
  });
});

describe("tableInput", () => {
  const { tables } = loadTemplate();

  it("creates every table in template.yaml with its keys", () => {
    expect(tables.length).toBeGreaterThan(0);
    for (const table of tables) {
      const input = tableInput(table);
      expect(input.TableName).toBe(table.tableName);
      expect(input.KeySchema?.map((k) => k.AttributeName)).toEqual(
        table.keySchema.map((k) => k.AttributeName)
      );
      expect(
        input.GlobalSecondaryIndexes?.map((g) => g.IndexName) ?? []
      ).toEqual(table.globalSecondaryIndexes.map((g) => g.indexName));
    }
  });

  it("declares every key attribute", () => {
    for (const table of tables) {
      const input = tableInput(table);
      const declared = new Set(
        input.AttributeDefinitions?.map((a) => a.AttributeName)
      );
      const used = [
        ...(input.KeySchema ?? []),
        ...(input.GlobalSecondaryIndexes ?? []).flatMap(
          (g) => g.KeySchema ?? []
        ),
      ];
      for (const key of used) {
        expect(declared.has(key.AttributeName!), table.tableName).toBe(true);
      }
    }
  });

  it("includes the tracker table's indexes used by the handlers", () => {
    const tracker = tables.find(
      (t) => t.tableName === "inactive_account_tracker_store"
    );
    expect(tracker?.globalSecondaryIndexes.map((g) => g.indexName)).toEqual([
      "CommonSubjectIdIndex",
      "EmailAddressIndex",
    ]);
  });
});
