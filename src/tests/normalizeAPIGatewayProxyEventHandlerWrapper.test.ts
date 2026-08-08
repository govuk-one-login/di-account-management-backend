import { describe, it, expect, vi } from "vitest";
import type { APIGatewayProxyEvent, Context } from "aws-lambda";
import { normalizeAPIGatewayProxyEventHandlerWrapper } from "../common/normalizeAPIGatewayProxyEventHandlerWrapper.js";

const baseEvent = {
  headers: {},
  multiValueHeaders: {},
} as APIGatewayProxyEvent;

const mockContext = {} as Context;

const mockResponse = { statusCode: 200, body: "" };

describe("normalizeAPIGatewayProxyEventHandlerWrapper", () => {
  it("lowercases header keys", async () => {
    const handler = vi.fn().mockResolvedValue(mockResponse);
    const wrapped = normalizeAPIGatewayProxyEventHandlerWrapper(handler);

    await wrapped(
      {
        ...baseEvent,
        headers: { "Content-Type": "application/json", Accept: "text/html" },
        multiValueHeaders: {
          "Content-Type": ["application/json"],
          Accept: ["text/html"],
        },
      },
      mockContext
    );

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { "content-type": "application/json", accept: "text/html" },
        multiValueHeaders: {
          "content-type": ["application/json"],
          accept: ["text/html"],
        },
      }),
      mockContext
    );
  });

  it("merges duplicate multi-value headers with different cases", async () => {
    const handler = vi.fn().mockResolvedValue(mockResponse);
    const wrapped = normalizeAPIGatewayProxyEventHandlerWrapper(handler);

    await wrapped(
      {
        ...baseEvent,
        multiValueHeaders: {
          Accept: ["text/html"],
          accept: ["application/json"],
        },
      },
      mockContext
    );

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        multiValueHeaders: { accept: ["text/html", "application/json"] },
      }),
      mockContext
    );
  });

  it("sets multi-value header to undefined when value is undefined", async () => {
    const handler = vi.fn().mockResolvedValue(mockResponse);
    const wrapped = normalizeAPIGatewayProxyEventHandlerWrapper(handler);

    await wrapped(
      { ...baseEvent, multiValueHeaders: { Accept: undefined } },
      mockContext
    );

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        multiValueHeaders: { accept: undefined },
      }),
      mockContext
    );
  });

  it("lowercases query string parameter keys", async () => {
    const handler = vi.fn().mockResolvedValue(mockResponse);
    const wrapped = normalizeAPIGatewayProxyEventHandlerWrapper(handler);

    await wrapped(
      {
        ...baseEvent,
        queryStringParameters: { Foo: "bar", Baz: "qux" },
        multiValueQueryStringParameters: {
          Foo: ["bar"],
          Baz: ["qux"],
        },
      },
      mockContext
    );

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        queryStringParameters: { foo: "bar", baz: "qux" },
        multiValueQueryStringParameters: {
          foo: ["bar"],
          baz: ["qux"],
        },
      }),
      mockContext
    );
  });

  it("merges duplicate multi-value query string parameters with different cases", async () => {
    const handler = vi.fn().mockResolvedValue(mockResponse);
    const wrapped = normalizeAPIGatewayProxyEventHandlerWrapper(handler);

    await wrapped(
      {
        ...baseEvent,
        multiValueQueryStringParameters: {
          Foo: ["bar"],
          foo: ["baz"],
        },
      },
      mockContext
    );

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        multiValueQueryStringParameters: { foo: ["bar", "baz"] },
      }),
      mockContext
    );
  });

  it("sets multi-value query string parameter to undefined when value is undefined", async () => {
    const handler = vi.fn().mockResolvedValue(mockResponse);
    const wrapped = normalizeAPIGatewayProxyEventHandlerWrapper(handler);

    await wrapped(
      {
        ...baseEvent,
        multiValueQueryStringParameters: { Foo: undefined },
      },
      mockContext
    );

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        multiValueQueryStringParameters: { foo: undefined },
      }),
      mockContext
    );
  });

  it("handles null query string parameters", async () => {
    const handler = vi.fn().mockResolvedValue(mockResponse);
    const wrapped = normalizeAPIGatewayProxyEventHandlerWrapper(handler);

    await wrapped(
      {
        ...baseEvent,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
      },
      mockContext
    );

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        queryStringParameters: {},
        multiValueQueryStringParameters: {},
      }),
      mockContext
    );
  });

  it("returns the handler response", async () => {
    const handler = vi.fn().mockResolvedValue(mockResponse);
    const wrapped = normalizeAPIGatewayProxyEventHandlerWrapper(handler);

    const result = await wrapped(baseEvent, mockContext);

    expect(result).toStrictEqual(mockResponse);
  });

  it("preserves other event properties", async () => {
    const handler = vi.fn().mockResolvedValue(mockResponse);
    const wrapped = normalizeAPIGatewayProxyEventHandlerWrapper(handler);

    await wrapped(
      { ...baseEvent, httpMethod: "GET", path: "/test" },
      mockContext
    );

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ httpMethod: "GET", path: "/test" }),
      mockContext
    );
  });
});
