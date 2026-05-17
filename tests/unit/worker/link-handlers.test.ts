/**
 * Unit tests for the GET / HEAD / UNLOCK / DELETE handler bodies that
 * were extracted out of `mountLinksRoutes` so each route's logic could
 * be tested in isolation. The integration suite still drives the full
 * HTTP lifecycle; these tests target the per-route branch coverage
 * (id-validation 404 collapse, v1 vs v2 GET, uses-left decrement,
 * backoff-gate, deletion-token hash check, etc.).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "hono";
import type { HonoEnv, LinkRecord } from "../../../worker/types";
import {
  handleDeleteLink,
  handleGetLink,
  handleHeadLink,
  handleUnlockLink,
} from "../../../worker/routes/links";
import { FakeKV } from "../../helpers/fake-kv";

interface CtxOptions {
  id?: string;
  body?: unknown;
  bodyThrows?: boolean;
  kv?: FakeKV;
}

function makeCtx(opts: CtxOptions = {}): { ctx: Context<HonoEnv>; kv: FakeKV } {
  const kv = opts.kv ?? new FakeKV();
  const ctx = {
    req: {
      param: (k: string) => (k === "id" ? opts.id : undefined),
      json: opts.bodyThrows
        ? () => Promise.reject(new SyntaxError("bad JSON"))
        : () => Promise.resolve(opts.body),
    },
    env: { VOIDHOP_KV: kv },
    json: (body: unknown, status = 200, headers?: Record<string, string>) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json", ...(headers ?? {}) },
      }),
  } as unknown as Context<HonoEnv>;
  return { ctx, kv };
}

function seed(kv: FakeKV, id: string, record: LinkRecord): void {
  kv.store.set(`links:${id}`, JSON.stringify(record));
}

const VALID_ID = "abcDEF12";
const VALID_BLOB = "AAAA";
const VALID_VERIFIER = "v".repeat(43);
const VALID_DELETION_HASH = "h".repeat(43);

beforeEach(() => vi.clearAllMocks());

describe("handleGetLink", () => {
  it("returns 404 NOT_FOUND for an invalid id format (item 17)", async () => {
    const { ctx } = makeCtx({ id: "!!!" });
    const res = await handleGetLink(ctx);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "NOT_FOUND" });
  });

  it("returns 404 when no record exists", async () => {
    const { ctx } = makeCtx({ id: VALID_ID });
    const res = await handleGetLink(ctx);
    expect(res.status).toBe(404);
  });

  it("returns 200 + blob for a v1 record without uses-left", async () => {
    const kv = new FakeKV();
    seed(kv, VALID_ID, {
      blob: VALID_BLOB,
      ttl: 3600,
      createdAt: "2026-05-17T00:00:00.000Z",
      version: 1,
    });
    const { ctx } = makeCtx({ id: VALID_ID, kv });
    const res = await handleGetLink(ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ blob: VALID_BLOB });
  });

  it("returns protected:true (no blob) for a v2 record", async () => {
    const kv = new FakeKV();
    seed(kv, VALID_ID, {
      blob: VALID_BLOB,
      ttl: 3600,
      createdAt: "2026-05-17T00:00:00.000Z",
      version: 2,
      verifier: VALID_VERIFIER,
      attemptsLeft: 5,
      usesLeft: 3,
    });
    const { ctx } = makeCtx({ id: VALID_ID, kv });
    const res = await handleGetLink(ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      protected: true,
      attemptsLeft: 5,
      usesLeft: 3,
    });
  });

  it("decrements usesLeft on a v1 read and deletes on the last use", async () => {
    const kv = new FakeKV();
    seed(kv, VALID_ID, {
      blob: VALID_BLOB,
      ttl: 3600,
      createdAt: "2026-05-17T00:00:00.000Z",
      version: 1,
      usesLeft: 1,
    });
    const { ctx } = makeCtx({ id: VALID_ID, kv });
    const res = await handleGetLink(ctx);
    expect(res.status).toBe(200);
    expect(kv.delete).toHaveBeenCalledWith(`links:${VALID_ID}`);
  });
});

describe("handleHeadLink", () => {
  it("404 for invalid id", async () => {
    const { ctx } = makeCtx({ id: "" });
    const res = await handleHeadLink(ctx);
    expect(res.status).toBe(404);
  });

  it("200 if the link exists, 404 if not (record body empty)", async () => {
    const kv = new FakeKV();
    seed(kv, VALID_ID, {
      blob: VALID_BLOB,
      ttl: 3600,
      createdAt: "2026-05-17T00:00:00.000Z",
      version: 1,
    });
    const { ctx: ctxFound } = makeCtx({ id: VALID_ID, kv });
    const found = await handleHeadLink(ctxFound);
    expect(found.status).toBe(200);

    const { ctx: ctxMissing } = makeCtx({ id: "missing0", kv });
    const missing = await handleHeadLink(ctxMissing);
    expect(missing.status).toBe(404);
  });
});

describe("handleUnlockLink", () => {
  function seedV2(kv: FakeKV, overrides: Partial<LinkRecord> = {}): void {
    seed(kv, VALID_ID, {
      blob: VALID_BLOB,
      ttl: 3600,
      createdAt: "2026-05-17T00:00:00.000Z",
      version: 2,
      verifier: VALID_VERIFIER,
      attemptsLeft: 5,
      ...overrides,
    } as LinkRecord);
  }

  it("404 for invalid id", async () => {
    const { ctx } = makeCtx({ id: "!!!" });
    const res = await handleUnlockLink(ctx);
    expect(res.status).toBe(404);
  });

  it("400 INVALID_VERIFIER when the body is unparseable", async () => {
    const { ctx } = makeCtx({ id: VALID_ID, body: undefined, bodyThrows: true });
    const res = await handleUnlockLink(ctx);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "INVALID_VERIFIER" });
  });

  it("400 INVALID_VERIFIER on a malformed verifier", async () => {
    const { ctx } = makeCtx({
      id: VALID_ID,
      body: { verifier: "too-short" },
    });
    const res = await handleUnlockLink(ctx);
    expect(res.status).toBe(400);
  });

  it("404 when the record doesn't exist", async () => {
    const { ctx } = makeCtx({
      id: VALID_ID,
      body: { verifier: VALID_VERIFIER },
    });
    const res = await handleUnlockLink(ctx);
    expect(res.status).toBe(404);
  });

  it("404 when the record is v1 (unlock only valid on v2)", async () => {
    const kv = new FakeKV();
    seed(kv, VALID_ID, {
      blob: VALID_BLOB,
      ttl: 3600,
      createdAt: "2026-05-17T00:00:00.000Z",
      version: 1,
    });
    const { ctx } = makeCtx({
      id: VALID_ID,
      body: { verifier: VALID_VERIFIER },
      kv,
    });
    const res = await handleUnlockLink(ctx);
    expect(res.status).toBe(404);
  });

  it("429 BACKOFF when backoffUntil is in the future", async () => {
    const kv = new FakeKV();
    seedV2(kv, { backoffUntil: Date.now() + 30_000 });
    const { ctx } = makeCtx({
      id: VALID_ID,
      body: { verifier: VALID_VERIFIER },
      kv,
    });
    const res = await handleUnlockLink(ctx);
    expect(res.status).toBe(429);
    expect(((await res.json()) as { error: string }).error).toBe("BACKOFF");
  });

  it("200 + blob on a verifier match", async () => {
    const kv = new FakeKV();
    seedV2(kv);
    const { ctx } = makeCtx({
      id: VALID_ID,
      body: { verifier: VALID_VERIFIER },
      kv,
    });
    const res = await handleUnlockLink(ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ blob: VALID_BLOB });
  });

  it("401 WRONG_PASSWORD and decremented attemptsLeft on a miss", async () => {
    const kv = new FakeKV();
    seedV2(kv);
    const { ctx } = makeCtx({
      id: VALID_ID,
      body: { verifier: "x".repeat(43) },
      kv,
    });
    const res = await handleUnlockLink(ctx);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string; attemptsLeft: number };
    expect(body.error).toBe("WRONG_PASSWORD");
    expect(body.attemptsLeft).toBe(4);
  });

  it("410 LINK_DESTROYED on the final miss", async () => {
    const kv = new FakeKV();
    seedV2(kv, { attemptsLeft: 1 });
    const { ctx } = makeCtx({
      id: VALID_ID,
      body: { verifier: "x".repeat(43) },
      kv,
    });
    const res = await handleUnlockLink(ctx);
    expect(res.status).toBe(410);
    expect(((await res.json()) as { error: string }).error).toBe(
      "LINK_DESTROYED",
    );
  });
});

describe("handleDeleteLink", () => {
  it("404 for invalid id", async () => {
    const { ctx } = makeCtx({ id: "!!!" });
    const res = await handleDeleteLink(ctx);
    expect(res.status).toBe(404);
  });

  it("400 INVALID_DELETION_TOKEN on unparseable body", async () => {
    const { ctx } = makeCtx({ id: VALID_ID, body: undefined, bodyThrows: true });
    const res = await handleDeleteLink(ctx);
    expect(res.status).toBe(400);
  });

  it("400 INVALID_DELETION_TOKEN on a malformed token", async () => {
    const { ctx } = makeCtx({
      id: VALID_ID,
      body: { token: "short" },
    });
    const res = await handleDeleteLink(ctx);
    expect(res.status).toBe(400);
  });

  it("404 when no record exists", async () => {
    const { ctx } = makeCtx({
      id: VALID_ID,
      body: { token: "a".repeat(43) },
    });
    const res = await handleDeleteLink(ctx);
    expect(res.status).toBe(404);
  });

  it("404 when record has no deletionTokenHash (creator opted out)", async () => {
    const kv = new FakeKV();
    seed(kv, VALID_ID, {
      blob: VALID_BLOB,
      ttl: 3600,
      createdAt: "2026-05-17T00:00:00.000Z",
      version: 1,
    });
    const { ctx } = makeCtx({
      id: VALID_ID,
      body: { token: "a".repeat(43) },
      kv,
    });
    const res = await handleDeleteLink(ctx);
    expect(res.status).toBe(404);
  });

  it("404 on wrong token (uniform attack surface)", async () => {
    const kv = new FakeKV();
    seed(kv, VALID_ID, {
      blob: VALID_BLOB,
      ttl: 3600,
      createdAt: "2026-05-17T00:00:00.000Z",
      version: 1,
      deletionTokenHash: VALID_DELETION_HASH,
    });
    const { ctx } = makeCtx({
      id: VALID_ID,
      body: { token: "z".repeat(43) },
      kv,
    });
    const res = await handleDeleteLink(ctx);
    expect(res.status).toBe(404);
  });

  it("204 on correct token; record is removed from KV", async () => {
    // Real SHA-256 of "T".repeat(43) is needed for the hash to match.
    const tokenBytes = new TextEncoder().encode("T".repeat(43));
    const digestBuf = await crypto.subtle.digest("SHA-256", tokenBytes);
    const digest = new Uint8Array(digestBuf);
    const alphabet =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let hash = "";
    for (let i = 0; i < digest.length; i += 3) {
      const b0 = digest[i]!;
      const b1 = i + 1 < digest.length ? digest[i + 1]! : 0;
      const b2 = i + 2 < digest.length ? digest[i + 2]! : 0;
      hash += alphabet[b0 >> 2]!;
      hash += alphabet[((b0 & 0x03) << 4) | (b1 >> 4)]!;
      if (i + 1 < digest.length) hash += alphabet[((b1 & 0x0f) << 2) | (b2 >> 6)]!;
      if (i + 2 < digest.length) hash += alphabet[b2 & 0x3f]!;
    }

    const kv = new FakeKV();
    seed(kv, VALID_ID, {
      blob: VALID_BLOB,
      ttl: 3600,
      createdAt: "2026-05-17T00:00:00.000Z",
      version: 1,
      deletionTokenHash: hash,
    });
    const { ctx } = makeCtx({
      id: VALID_ID,
      body: { token: "T".repeat(43) },
      kv,
    });
    const res = await handleDeleteLink(ctx);
    expect(res.status).toBe(204);
    expect(kv.delete).toHaveBeenCalledWith(`links:${VALID_ID}`);
  });
});
