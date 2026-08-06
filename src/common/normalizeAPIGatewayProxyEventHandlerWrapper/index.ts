import type { APIGatewayProxyHandler } from "../types.js";

export const normalizeAPIGatewayProxyEventHandlerWrapper = (
  handler: APIGatewayProxyHandler
): APIGatewayProxyHandler => {
  const wrappedHandler: APIGatewayProxyHandler = async (event, context) => {
    const normalizedHeaders: (typeof event)["headers"] = {};
    const normalizedMultiHeaders: (typeof event)["multiValueHeaders"] = {};

    for (const [key, value] of Object.entries(event.headers)) {
      normalizedHeaders[key.toLowerCase()] = value;
    }

    for (const [key, value] of Object.entries(event.multiValueHeaders)) {
      const lowercaseKey = key.toLowerCase();

      const values = [
        ...(normalizedMultiHeaders[lowercaseKey] ?? []),
        ...(value ?? []),
      ];
      normalizedMultiHeaders[lowercaseKey] = values.length ? values : undefined;
    }

    const normalizedQueryStringParameters: (typeof event)["queryStringParameters"] =
      {};
    const normalizedMultiQueryStringParameters: (typeof event)["multiValueQueryStringParameters"] =
      {};

    for (const [key, value] of Object.entries(
      event.queryStringParameters ?? {}
    )) {
      normalizedQueryStringParameters[key.toLowerCase()] = value;
    }

    for (const [key, value] of Object.entries(
      event.multiValueQueryStringParameters ?? {}
    )) {
      const lowercaseKey = key.toLowerCase();

      const values = [
        ...(normalizedMultiQueryStringParameters[lowercaseKey] ?? []),
        ...(value ?? []),
      ];
      normalizedMultiQueryStringParameters[lowercaseKey] = values.length
        ? values
        : undefined;
    }

    const res = await handler(
      {
        ...event,
        headers: normalizedHeaders,
        multiValueHeaders: normalizedMultiHeaders,
        queryStringParameters: normalizedQueryStringParameters,
        multiValueQueryStringParameters: normalizedMultiQueryStringParameters,
      },
      context
    );

    return res;
  };
  return wrappedHandler;
};
