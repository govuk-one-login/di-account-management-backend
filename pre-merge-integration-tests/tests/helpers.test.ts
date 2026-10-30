// Unit tests for the non-AWS helpers (ID generators and the httpPost wrapper).
// `fetch` is stubbed, so these run in the normal `npm test` unit run.

import { afterEach, describe, expect, it, vi } from "vitest";

import { generateEventId, generateUserId, httpPost } from "../helpers.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("generateUserId", () => {
  it("formats the id as premerge-{testName}-{8 hex chars}", () => {
    const id = generateUserId("auth-code-issued");
    expect(id).toMatch(/^premerge-auth-code-issued-[0-9a-f]{8}$/);
  });

  it("includes the supplied test name verbatim", () => {
    expect(generateUserId("my_test")).toContain("premerge-my_test-");
  });

  it("produces a unique suffix on each call", () => {
    const ids = new Set(
      Array.from({ length: 50 }, () => generateUserId("dup"))
    );
    expect(ids.size).toBe(50);
  });
});

describe("generateEventId", () => {
  it("returns a valid v4-style UUID", () => {
    expect(generateEventId()).toMatch(UUID_REGEX);
  });

  it("produces a unique value on each call", () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateEventId()));
    expect(ids.size).toBe(50);
  });
});

describe("httpPost", () => {
  it("JSON-serialises object payloads and merges the content-type header", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("ok-body", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await httpPost(
      "https://api.example.gov.uk/x",
      { a: 1 },
      { Authorization: "Bearer token" }
    );

    expect(result).toStrictEqual({ status: 200, body: "ok-body" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.gov.uk/x");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
    expect(init.headers).toStrictEqual({
      Authorization: "Bearer token",
      "Content-Type": "application/json",
    });
  });

  it("passes string payloads through unchanged", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await httpPost("https://api.example.gov.uk/x", "raw");

    expect(result.status).toBe(403);
    expect(fetchMock.mock.calls[0][1].body).toBe("raw");
  });

  it("returns non-2xx responses without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("bad", { status: 400 }))
    );

    await expect(
      httpPost("https://api.example.gov.uk/x", {})
    ).resolves.toStrictEqual({ status: 400, body: "bad" });
  });

  it("re-throws a non-abort fetch error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down"))
    );

    await expect(httpPost("https://api.example.gov.uk/x", {})).rejects.toThrow(
      "network down"
    );
  });
});
