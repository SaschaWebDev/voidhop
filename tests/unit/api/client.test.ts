/**
 * Unit tests for the typed API client. Covers the pure helpers
 * (`mapErrorCode`, `parseErrorBody`) plus the fetch-based wrappers
 * (`createLink`, `unlockLink`, `getBlob`, `deleteLink`) using a
 * `globalThis.fetch` mock — no network calls, no Miniflare.
 *
 * The KV-replication retry inside `getBlob` is exercised with a fake
 * timer + signal abort so the second-attempt branch is reachable
 * without a 100ms wall-clock delay per test case.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createLink,
  deleteLink,
  getBlob,
  mapErrorCode,
  parseErrorBody,
  unlockLink,
} from "@/api/client";
import { ApiError } from "@/api/types";

type FetchMock = ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

let fetchMock: FetchMock;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("mapErrorCode", () => {
  it.each([
    ["RATE_LIMITED", "RATE_LIMITED"],
    ["DAILY_BUDGET_EXHAUSTED", "BUDGET_EXHAUSTED"],
    ["ORIGIN_BUDGET_EXHAUSTED", "ORIGIN_BUDGET_EXHAUSTED"],
    ["BLOB_TOO_LARGE", "BLOB_TOO_LARGE"],
    ["INVALID_BLOB", "VALIDATION_ERROR"],
    ["INVALID_TTL", "VALIDATION_ERROR"],
    ["INVALID_VERIFIER", "VALIDATION_ERROR"],
    ["INVALID_USES_LEFT", "VALIDATION_ERROR"],
    ["INVALID_DELETION_TOKEN", "VALIDATION_ERROR"],
    ["INVALID_DELETION_TOKEN_HASH", "VALIDATION_ERROR"],
    ["NOT_FOUND", "NOT_FOUND"],
    ["WRONG_PASSWORD", "WRONG_PASSWORD"],
    ["LINK_DESTROYED", "LINK_DESTROYED"],
    ["BACKOFF", "BACKOFF"],
  ])("maps server code %s -> ApiErrorType %s", (input, expected) => {
    expect(mapErrorCode(input)).toBe(expected);
  });

  it("returns SERVER_ERROR for an unknown code", () => {
    expect(mapErrorCode("KABOOM")).toBe("SERVER_ERROR");
  });

  it("returns SERVER_ERROR for undefined", () => {
    expect(mapErrorCode(undefined)).toBe("SERVER_ERROR");
  });
});

describe("parseErrorBody", () => {
  it("extracts all fields when present", async () => {
    const res = jsonResponse({
      error: "WRONG_PASSWORD",
      attemptsLeft: 3,
      retryAfterMs: 5000,
    });
    expect(await parseErrorBody(res)).toEqual({
      code: "WRONG_PASSWORD",
      attemptsLeft: 3,
      retryAfterMs: 5000,
    });
  });

  it("omits absent fields rather than emitting `undefined`", async () => {
    const res = jsonResponse({ error: "X" });
    const out = await parseErrorBody(res);
    expect(out).toEqual({ code: "X" });
    expect("attemptsLeft" in out).toBe(false);
    expect("retryAfterMs" in out).toBe(false);
  });

  it("returns empty object when JSON is malformed", async () => {
    const res = new Response("not json", { status: 500 });
    expect(await parseErrorBody(res)).toEqual({});
  });

  it("returns empty object when JSON has no expected fields", async () => {
    const res = jsonResponse({ some: "other" });
    expect(await parseErrorBody(res)).toEqual({});
  });
});

describe("createLink", () => {
  it("returns parsed JSON on 201", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "abc123" }, { status: 201 }));
    const out = await createLink({ blob: "b", ttl: 3600 });
    expect(out).toEqual({ id: "abc123" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/links$/);
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      blob: "b",
      ttl: 3600,
    });
  });

  it("throws ApiError with the mapped type on a 400", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "INVALID_TTL" }, { status: 400 }),
    );
    await expect(createLink({ blob: "b", ttl: 0 })).rejects.toMatchObject({
      type: "VALIDATION_ERROR",
    });
  });

  it("throws ApiError(RATE_LIMITED) with retryAfter on 429", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { error: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": "60" } },
      ),
    );
    try {
      await createLink({ blob: "b", ttl: 3600 });
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).type).toBe("RATE_LIMITED");
      expect((e as ApiError).retryAfter).toBe(60);
    }
  });

  it("throws ApiError(NETWORK_ERROR) when fetch itself rejects", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(createLink({ blob: "b", ttl: 3600 })).rejects.toMatchObject({
      type: "NETWORK_ERROR",
    });
  });

  it("propagates AbortError instead of wrapping it", async () => {
    fetchMock.mockRejectedValueOnce(new DOMException("Aborted", "AbortError"));
    await expect(createLink({ blob: "b", ttl: 3600 })).rejects.toMatchObject({
      name: "AbortError",
    });
  });
});

describe("unlockLink", () => {
  it("returns blob on success", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ blob: "B" }));
    const out = await unlockLink("abc", { verifier: "v" });
    expect(out).toEqual({ blob: "B" });
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/\/links\/abc\/unlock$/);
  });

  it("carries attemptsLeft on a 401 WRONG_PASSWORD", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { error: "WRONG_PASSWORD", attemptsLeft: 2 },
        { status: 401 },
      ),
    );
    try {
      await unlockLink("abc", { verifier: "v" });
      throw new Error("expected throw");
    } catch (e) {
      expect((e as ApiError).type).toBe("WRONG_PASSWORD");
      expect((e as ApiError).attemptsLeft).toBe(2);
    }
  });

  it("carries retryAfterMs on a 429 BACKOFF", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { error: "BACKOFF", attemptsLeft: 1, retryAfterMs: 30_000 },
        { status: 429, headers: { "Retry-After": "30" } },
      ),
    );
    try {
      await unlockLink("abc", { verifier: "v" });
      throw new Error("expected throw");
    } catch (e) {
      expect((e as ApiError).type).toBe("BACKOFF");
      expect((e as ApiError).retryAfterMs).toBe(30_000);
      expect((e as ApiError).attemptsLeft).toBe(1);
    }
  });

  it("encodes the id in the URL", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ blob: "B" }));
    await unlockLink("a/b c", { verifier: "v" });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("a%2Fb%20c");
  });
});

describe("getBlob", () => {
  it("returns the blob directly on 200 (v1, unprotected)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ blob: "B" }));
    expect(await getBlob("abc")).toEqual({ blob: "B" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns the protected marker for v2 links", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ protected: true, attemptsLeft: 5 }),
    );
    const out = await getBlob("abc");
    expect(out).toMatchObject({ protected: true, attemptsLeft: 5 });
  });

  it("retries exactly once on a 404, then throws NOT_FOUND", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "NOT_FOUND" }, { status: 404 }))
      .mockResolvedValueOnce(jsonResponse({ error: "NOT_FOUND" }, { status: 404 }));

    const onRetry = vi.fn();
    const promise = getBlob("abc", { onRetry });
    // Attach the rejection assertion BEFORE advancing timers so the
    // rejection isn't observed as unhandled by the harness.
    const assertion = expect(promise).rejects.toMatchObject({ type: "NOT_FOUND" });
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("returns the blob if the retry succeeds", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "NOT_FOUND" }, { status: 404 }))
      .mockResolvedValueOnce(jsonResponse({ blob: "late" }));
    const promise = getBlob("abc");
    await vi.runAllTimersAsync();
    expect(await promise).toEqual({ blob: "late" });
  });

  it("throws on non-404 error responses without retrying", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "RATE_LIMITED" }, { status: 429 }),
    );
    await expect(getBlob("abc")).rejects.toMatchObject({ type: "RATE_LIMITED" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("wraps fetch network failures in ApiError(NETWORK_ERROR)", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("network down"));
    await expect(getBlob("abc")).rejects.toMatchObject({ type: "NETWORK_ERROR" });
  });
});

describe("deleteLink", () => {
  it("resolves on 204", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(deleteLink("abc", "tok")).resolves.toBeUndefined();
    const [, init] = fetchMock.mock.calls[0]!;
    expect((init as RequestInit).method).toBe("DELETE");
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      token: "tok",
    });
  });

  it("throws ApiError(NOT_FOUND) on 404", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "NOT_FOUND" }, { status: 404 }),
    );
    await expect(deleteLink("abc", "tok")).rejects.toMatchObject({
      type: "NOT_FOUND",
    });
  });

  it("throws ApiError(SERVER_ERROR) on 500", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 500 }));
    await expect(deleteLink("abc", "tok")).rejects.toMatchObject({
      type: "SERVER_ERROR",
    });
  });

  it("throws ApiError(NETWORK_ERROR) when fetch rejects", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    await expect(deleteLink("abc", "tok")).rejects.toMatchObject({
      type: "NETWORK_ERROR",
    });
  });

  it("propagates AbortError", async () => {
    fetchMock.mockRejectedValueOnce(new DOMException("Aborted", "AbortError"));
    await expect(deleteLink("abc", "tok")).rejects.toMatchObject({
      name: "AbortError",
    });
  });
});
