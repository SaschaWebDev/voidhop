/**
 * Unit tests for the POST /api/v1/links handler body. Exercises the
 * validate → reserve-id → persist → increment-budget pipeline using an
 * in-memory KV stub. The integration test (tests/integration/links-api)
 * already covers the full request lifecycle including middleware; this
 * file targets the handler's branch coverage in isolation so CRAP drops.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "hono";
import type { HonoEnv } from "../../../worker/types";
import { handleCreateLink } from "../../../worker/routes/links";

class FakeKV {
  store = new Map<string, string>();
  get = vi.fn(async (key: string) => this.store.get(key) ?? null);
  put = vi.fn(async (key: string, value: string) => {
    this.store.set(key, value);
  });
  delete = vi.fn(async (key: string) => {
    this.store.delete(key);
  });
  list = vi.fn(async () => ({ keys: [], list_complete: true, cursor: "" }));
}

interface CtxOptions {
  body: unknown;
  bodyThrows?: boolean;
  budgetGlobalCount?: number;
  budgetOrigin?: string | null;
  budgetOriginCount?: number | null;
  kv?: FakeKV;
}

function makeCtx(opts: CtxOptions): { ctx: Context<HonoEnv>; kv: FakeKV } {
  const kv = opts.kv ?? new FakeKV();
  const vars = new Map<string, unknown>([
    ["budgetGlobalCount", opts.budgetGlobalCount ?? 0],
    ["budgetOrigin", opts.budgetOrigin ?? null],
    ["budgetOriginCount", opts.budgetOriginCount ?? null],
  ]);
  const ctx = {
    req: {
      json: opts.bodyThrows
        ? () => Promise.reject(new SyntaxError("bad JSON"))
        : () => Promise.resolve(opts.body),
    },
    env: { VOIDHOP_KV: kv },
    get: (k: string) => vars.get(k),
    set: (k: string, v: unknown) => {
      vars.set(k, v);
    },
    json: (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  } as unknown as Context<HonoEnv>;
  return { ctx, kv };
}

const VALID_BLOB = "AAAA";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("handleCreateLink", () => {
  it("happy path: persists a v1 record and returns 201 with id", async () => {
    const { ctx, kv } = makeCtx({ body: { blob: VALID_BLOB, ttl: 3600 } });
    const res = await handleCreateLink(ctx);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    expect(typeof body.id).toBe("string");
    expect(body.id.length).toBeGreaterThanOrEqual(6);
    // The record was persisted with `links:<id>` key per the store impl.
    const stored = kv.store.get(`links:${body.id}`);
    expect(stored).toBeDefined();
    const record = JSON.parse(stored as string) as {
      blob: string;
      version: number;
    };
    expect(record.blob).toBe(VALID_BLOB);
    expect(record.version).toBe(1);
  });

  it("v2 path: with verifier produces a version-2 record", async () => {
    const { ctx, kv } = makeCtx({
      body: {
        blob: VALID_BLOB,
        ttl: 3600,
        verifier: "v".repeat(43),
      },
    });
    const res = await handleCreateLink(ctx);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    const record = JSON.parse(kv.store.get(`links:${body.id}`) as string) as {
      version: number;
      verifier: string;
    };
    expect(record.version).toBe(2);
    expect(record.verifier).toBe("v".repeat(43));
  });

  it("returns 400 INVALID_BLOB when the body is not JSON", async () => {
    const { ctx } = makeCtx({ body: undefined, bodyThrows: true });
    const res = await handleCreateLink(ctx);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "INVALID_BLOB" });
  });

  it("returns 400 INVALID_BLOB when the body is not an object", async () => {
    const { ctx } = makeCtx({ body: "literal string" });
    const res = await handleCreateLink(ctx);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "INVALID_BLOB" });
  });

  it("returns 400 INVALID_TTL when the ttl is not in the allow-list", async () => {
    const { ctx } = makeCtx({ body: { blob: VALID_BLOB, ttl: 60 } });
    const res = await handleCreateLink(ctx);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "INVALID_TTL" });
  });

  it("returns 400 INVALID_VERIFIER on a malformed verifier", async () => {
    const { ctx } = makeCtx({
      body: { blob: VALID_BLOB, ttl: 3600, verifier: "short" },
    });
    const res = await handleCreateLink(ctx);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "INVALID_VERIFIER" });
  });

  it("returns 500 STORAGE_ERROR if KV.put rejects", async () => {
    const kv = new FakeKV();
    kv.put.mockRejectedValueOnce(new Error("KV down"));
    const { ctx } = makeCtx({ body: { blob: VALID_BLOB, ttl: 3600 }, kv });
    const res = await handleCreateLink(ctx);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "STORAGE_ERROR" });
  });

  it("best-effort budget increment is non-fatal — handler still returns 201", async () => {
    const kv = new FakeKV();
    // Make every counter PUT throw, but link PUT succeed.
    const realPut = kv.put;
    kv.put = vi.fn(async (key: string, value: string) => {
      if (key.startsWith("__meta:writes:")) throw new Error("counter fail");
      return realPut(key, value);
    });
    const { ctx } = makeCtx({
      body: { blob: VALID_BLOB, ttl: 3600 },
      budgetGlobalCount: 5,
      budgetOrigin: "https://voidhop.com",
      budgetOriginCount: 3,
      kv,
    });
    const res = await handleCreateLink(ctx);
    expect(res.status).toBe(201);
  });

  it("includes usesLeft and deletionTokenHash on the persisted record when supplied", async () => {
    const { ctx, kv } = makeCtx({
      body: {
        blob: VALID_BLOB,
        ttl: 3600,
        usesLeft: 5,
        deletionTokenHash: "h".repeat(43),
      },
    });
    const res = await handleCreateLink(ctx);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    const record = JSON.parse(kv.store.get(`links:${body.id}`) as string) as {
      usesLeft: number;
      deletionTokenHash: string;
    };
    expect(record.usesLeft).toBe(5);
    expect(record.deletionTokenHash).toBe("h".repeat(43));
  });
});
