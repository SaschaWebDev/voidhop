/**
 * `handleUnhandledError` is the worker's last-resort onError callback.
 * Asserts the dev-time logging shape (so failures stay debuggable) and
 * the production-safe 500 response body (so internal details never leak).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "hono";
import type { HonoEnv } from "../../../worker/types";
import { handleUnhandledError } from "../../../worker/index";

function makeCtx(method: string, url: string): Context<HonoEnv> {
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  return {
    req: { method, url },
    json,
  } as unknown as Context<HonoEnv>;
}

let errorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  errorSpy.mockRestore();
});

describe("handleUnhandledError", () => {
  it("returns a 500 SERVER_ERROR response", async () => {
    const ctx = makeCtx("POST", "https://x.example/api/v1/links");
    const res = handleUnhandledError(new Error("boom"), ctx);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "SERVER_ERROR" });
  });

  it("logs the request method + url and the error name + message", () => {
    const err = new Error("boom message");
    err.name = "BoomError";
    handleUnhandledError(err, makeCtx("GET", "https://x.example/foo"));
    const flat = errorSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(flat).toMatch(/\[voidhop\] unhandled error/);
    expect(flat).toMatch(/GET https:\/\/x\.example\/foo/);
    expect(flat).toMatch(/BoomError/);
    expect(flat).toMatch(/boom message/);
  });

  it("logs the stack when the error has one", () => {
    const err = new Error("with stack");
    err.stack = "Error: with stack\n    at fake.ts:1:1";
    handleUnhandledError(err, makeCtx("GET", "https://x/y"));
    const flat = errorSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(flat).toMatch(/fake\.ts/);
  });

  it("handles non-Error throwables (string/object) without crashing", async () => {
    const ctxA = makeCtx("GET", "https://x/y");
    const resA = handleUnhandledError("a string thrown", ctxA);
    expect(resA.status).toBe(500);
    expect(await resA.json()).toEqual({ error: "SERVER_ERROR" });

    const ctxB = makeCtx("GET", "https://x/y");
    const resB = handleUnhandledError({ foo: 1 }, ctxB);
    expect(resB.status).toBe(500);
    expect(await resB.json()).toEqual({ error: "SERVER_ERROR" });

    // Non-Error throwables log under "UnknownError".
    const flat = errorSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(flat).toMatch(/UnknownError/);
  });

  it("does not log a stack line when the error has no stack", () => {
    const err = new Error("no stack");
    delete (err as { stack?: string }).stack;
    handleUnhandledError(err, makeCtx("GET", "https://x/y"));
    // 3 prefix log lines, no stack tail line.
    expect(errorSpy).toHaveBeenCalledTimes(3);
  });
});
