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
import { FakeKV } from "../../helpers/fake-kv";

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

/**
 * Run the handler against `body` and return the parsed JSON id plus the
 * persisted record. Asserts a 201 status — fails the test if not.
 */
async function runCreateAndGetRecord(
  body: unknown,
): Promise<{ id: string; record: Record<string, unknown>; kv: FakeKV }> {
  const { ctx, kv } = makeCtx({ body });
  const res = await handleCreateLink(ctx);
  expect(res.status).toBe(201);
  const { id } = (await res.json()) as { id: string };
  const record = JSON.parse(kv.store.get(`links:${id}`) as string) as Record<
    string,
    unknown
  >;
  return { id, record, kv };
}

async function expectErrorResponse(
  body: unknown,
  status: number,
  errorCode: string,
): Promise<void> {
  const { ctx } = makeCtx({ body });
  const res = await handleCreateLink(ctx);
  expect(res.status).toBe(status);
  expect(await res.json()).toEqual({ error: errorCode });
}

describe("handleCreateLink", () => {
  it("happy path: persists a v1 record and returns 201 with id", async () => {
    const { id, record } = await runCreateAndGetRecord({
      blob: VALID_BLOB,
      ttl: 3600,
    });
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThanOrEqual(6);
    expect(record.blob).toBe(VALID_BLOB);
    expect(record.version).toBe(1);
  });

  it("v2 path: with verifier produces a version-2 record", async () => {
    const { record } = await runCreateAndGetRecord({
      blob: VALID_BLOB,
      ttl: 3600,
      verifier: "v".repeat(43),
    });
    expect(record.version).toBe(2);
    expect(record.verifier).toBe("v".repeat(43));
  });

  it.each([
    ["body is not JSON (parse fails)", undefined, true, 400, "INVALID_BLOB"],
    ["body is not an object", "literal string", false, 400, "INVALID_BLOB"],
    [
      "ttl is not in the allow-list",
      { blob: VALID_BLOB, ttl: 60 },
      false,
      400,
      "INVALID_TTL",
    ],
    [
      "verifier is malformed",
      { blob: VALID_BLOB, ttl: 3600, verifier: "short" },
      false,
      400,
      "INVALID_VERIFIER",
    ],
  ] as const)(
    "rejects when %s",
    async (_, body, bodyThrows, status, code) => {
      if (bodyThrows) {
        const { ctx } = makeCtx({ body, bodyThrows: true });
        const res = await handleCreateLink(ctx);
        expect(res.status).toBe(status);
        expect(await res.json()).toEqual({ error: code });
      } else {
        await expectErrorResponse(body, status, code);
      }
    },
  );

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
    const { record } = await runCreateAndGetRecord({
      blob: VALID_BLOB,
      ttl: 3600,
      usesLeft: 5,
      deletionTokenHash: "h".repeat(43),
    });
    expect(record.usesLeft).toBe(5);
    expect(record.deletionTokenHash).toBe("h".repeat(43));
  });
});
