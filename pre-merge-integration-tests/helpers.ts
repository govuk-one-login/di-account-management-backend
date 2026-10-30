// Non-AWS helpers for the integration suite: deterministic test-ID generators
// and a small HTTP POST wrapper. Kept separate from aws-helpers.ts, which deals
// only with deployed AWS infrastructure.

import { randomUUID } from "node:crypto";

// Returns `premerge-{testName}-{first 8 chars of a uuid}`.
export function generateUserId(testName: string): string {
  const shortUuid = randomUUID().slice(0, 8);
  return `premerge-${testName}-${shortUuid}`;
}

export function generateEventId(): string {
  return randomUUID();
}

export interface HttpPostResult {
  status: number;
  body: string;
}

// POSTs `payload` (objects are JSON-serialised, strings sent as-is) to `url`
// with a Content-Type: application/json header merged into `headers`. Returns
// the status and body for any status without throwing; aborts and throws after
// 30s with no response.
export async function httpPost(
  url: string,
  payload: Record<string, unknown> | string,
  headers?: Record<string, string>
): Promise<HttpPostResult> {
  const requestBody =
    typeof payload === "string" ? payload : JSON.stringify(payload);

  const requestHeaders: Record<string, string> = {
    ...headers,
    "Content-Type": "application/json",
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: requestHeaders,
      body: requestBody,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(
        `HTTP POST to "${url}" did not receive a response within 30s and was aborted.`,
        { cause: error }
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  const body = await response.text();
  return { status: response.status, body };
}
