/**
 * /api/v1/links — POST, GET, HEAD, DELETE. SRS §9.2.
 *
 * The POST handler implements the inline blob fast pre-check (§11.1 / item 4)
 * before invoking Zod. As of v1.1.1 there is no size-tier TTL ceiling — the
 * TTL is universally capped at 7 days, enforced by the allowed-values list.
 *
 * GET / HEAD / DELETE collapse "invalid ID format" into 404 (item 17) so
 * that an attacker cannot map the ID validator via response-shape timing.
 *
 * Routes are registered FLAT on the parent Hono app (no sub-router) to avoid
 * Hono's sub-router base-path matching ambiguity, which previously caused
 * `app.route("/api/v1/links", subapp) + subapp.post("/", ...)` to miss the
 * trailing-slash-less request `POST /api/v1/links`.
 */

import type { Context, Hono } from "hono";
import { z } from "zod";
import type { HonoEnv, LinkRecord, LinkRecordV2 } from "../types";
import { IdCollisionError } from "../types";
import { CloudflareKVLinkStore } from "../store/kv-link-store";
import { generateAndReserveId } from "../id-generator";
import {
  dailyBudgetMiddleware,
  incrementBudgetCounters,
  todayKey,
} from "../middleware/daily-budget";
import { rateLimitMiddleware } from "../middleware/rate-limit";

// ─── Constants (worker-local copies) ──────────────────────────────────────────

const ID_MIN_LENGTH = 6;
const ID_MAX_LENGTH = 12;
const MAX_BLOB_SIZE_BYTES = 256 * 1024;
const MAX_BLOB_SIZE_B64 = Math.ceil((MAX_BLOB_SIZE_BYTES * 4) / 3);

/**
 * Three TTL options. 7 days is the universal max — see SRS §6.2.
 */
const ALLOWED_TTL_SECONDS = [3600, 86400, 604800] as const;

/**
 * Password-verifier length and retry budget. Duplicated from
 * `src/constants/index.ts` because the worker tree cannot import from the
 * browser tree (separate tsconfig). Keep in sync.
 */
const VERIFIER_B64URL_LENGTH = 43;
const MAX_PASSWORD_ATTEMPTS = 5;

/** Hash of the creator deletion token (SHA-256, base64url without padding). */
const DELETION_TOKEN_HASH_B64URL_LENGTH = 43;

/**
 * Sanity ceiling on the multi-use counter. Matches `MAX_USES_LEFT` in the
 * browser constants. A ceiling lets us reject pathological input while
 * keeping the field trivially auditable.
 */
const MAX_USES_LEFT = 100;

/**
 * Backoff schedule by `attemptsLeft` after the miss. Index k = delay when
 * attemptsLeft === k. Duplicated from
 * `src/constants/index.ts:PASSWORD_BACKOFF_MS_BY_ATTEMPTS_LEFT`.
 */
const PASSWORD_BACKOFF_MS_BY_ATTEMPTS_LEFT: readonly number[] = [
  0, 120_000, 30_000, 5_000, 1_000, 0,
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
//
// The pure helpers below (validators, refresh/build/parse, backoff gate,
// constant-time compare) are exported solely so that
// `tests/unit/worker/links-helpers.test.ts` can exercise them in isolation.
// They are not part of the public worker surface — Hono only sees the
// `mountLinksRoutes` entry point.

export function isValidId(id: string): boolean {
  if (id.length < ID_MIN_LENGTH || id.length > ID_MAX_LENGTH) return false;
  for (let i = 0; i < id.length; i++) {
    const c = id.charCodeAt(i);
    const ok =
      (c >= 65 && c <= 90) ||
      (c >= 97 && c <= 122) ||
      (c >= 48 && c <= 57) ||
      c === 45 ||
      c === 95;
    if (!ok) return false;
  }
  return true;
}

/** Shared base64url-alphabet check (no regex, no allocations). */
export function isBase64UrlString(
  s: unknown,
  expectedLength: number,
): s is string {
  if (typeof s !== "string") return false;
  if (s.length !== expectedLength) return false;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    const ok =
      (c >= 65 && c <= 90) ||
      (c >= 97 && c <= 122) ||
      (c >= 48 && c <= 57) ||
      c === 45 ||
      c === 95;
    if (!ok) return false;
  }
  return true;
}

export function isValidVerifier(s: unknown): s is string {
  return isBase64UrlString(s, VERIFIER_B64URL_LENGTH);
}

export function isValidDeletionTokenHash(s: unknown): s is string {
  return isBase64UrlString(s, DELETION_TOKEN_HASH_B64URL_LENGTH);
}

/**
 * Validate an opt-in uses-left counter. Must be a positive integer within the
 * auditable ceiling.
 */
export function isValidUsesLeft(n: unknown): n is number {
  return (
    typeof n === "number" &&
    Number.isInteger(n) &&
    n >= 1 &&
    n <= MAX_USES_LEFT
  );
}

/**
 * Constant-time equality check on two strings of equal length. Falls back to
 * comparing lengths first (non-constant) then XOR-ORs each char code to avoid
 * leaking information about the prefix of a mismatching verifier.
 *
 * Cloudflare Workers have no `crypto.timingSafeEqual`; this is the idiomatic
 * hand-rolled replacement.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Produce a refreshed V2 record with select counter fields overridden and
 * optional fields conditionally present. Exists because our tsconfig has
 * `exactOptionalPropertyTypes: true`, which forbids `field: undefined` on
 * optional properties — we must omit the key entirely.
 */
export function refreshRecord(
  record: LinkRecordV2,
  opts: {
    attemptsLeft?: number;
    usesLeft?: number;
    backoffUntil?: number;
    clearBackoff?: boolean;
  },
): LinkRecordV2 {
  const next: LinkRecordV2 = {
    blob: record.blob,
    ttl: record.ttl,
    createdAt: record.createdAt,
    version: 2,
    verifier: record.verifier,
    attemptsLeft:
      opts.attemptsLeft !== undefined ? opts.attemptsLeft : record.attemptsLeft,
  };
  const carriedUsesLeft =
    opts.usesLeft !== undefined ? opts.usesLeft : record.usesLeft;
  if (carriedUsesLeft !== undefined) next.usesLeft = carriedUsesLeft;
  if (record.deletionTokenHash !== undefined) {
    next.deletionTokenHash = record.deletionTokenHash;
  }
  if (!opts.clearBackoff) {
    const carriedBackoff =
      opts.backoffUntil !== undefined ? opts.backoffUntil : record.backoffUntil;
    if (carriedBackoff !== undefined) next.backoffUntil = carriedBackoff;
  }
  return next;
}

/**
 * Inline blob validation: type, length, charset. No regex, no Zod. SR-INPUT-02.
 * Returns null on success, an error response payload on failure.
 */
export function validateBlob(blob: unknown):
  | { ok: true }
  | { ok: false; status: 400; body: { error: string } } {
  if (typeof blob !== "string") {
    return { ok: false, status: 400, body: { error: "INVALID_BLOB" } };
  }
  if (blob.length === 0 || blob.length > MAX_BLOB_SIZE_B64) {
    return { ok: false, status: 400, body: { error: "BLOB_TOO_LARGE" } };
  }
  for (let i = 0; i < blob.length; i++) {
    const c = blob.charCodeAt(i);
    const ok =
      (c >= 65 && c <= 90) ||
      (c >= 97 && c <= 122) ||
      (c >= 48 && c <= 57) ||
      c === 45 ||
      c === 95;
    if (!ok) return { ok: false, status: 400, body: { error: "INVALID_BLOB" } };
  }
  return { ok: true };
}

const ttlSchema = z
  .number()
  .int()
  .refine((v) => (ALLOWED_TTL_SECONDS as readonly number[]).includes(v), {
    message: "INVALID_TTL",
  });

/**
 * Read JSON body and assert it's a plain object. Returns the parsed object
 * or a discriminated error so callers can shape the response without
 * repeating the try/catch and `typeof === "object"` dance.
 */
async function parseJsonObject(
  c: { req: { json: () => Promise<unknown> } },
): Promise<
  | { ok: true; obj: Record<string, unknown> }
  | { ok: false }
> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return { ok: false };
  }
  if (typeof body !== "object" || body === null) {
    return { ok: false };
  }
  return { ok: true, obj: body as Record<string, unknown> };
}

export interface CreateInput {
  blob: string;
  ttl: number;
  verifier: string | null;
  usesLeft: number | undefined;
  deletionTokenHash: string | undefined;
}

/**
 * Validate every field of a /links POST body. Either returns a typed
 * `CreateInput` or the precise error code the handler should respond with.
 */
export function parseCreateInput(
  obj: Record<string, unknown>,
):
  | { ok: true; input: CreateInput }
  | { ok: false; status: 400; body: { error: string } } {
  const blobCheck = validateBlob(obj.blob);
  if (!blobCheck.ok) return blobCheck;
  const blob = obj.blob as string;

  const ttlParse = ttlSchema.safeParse(obj.ttl);
  if (!ttlParse.success) {
    return { ok: false, status: 400, body: { error: "INVALID_TTL" } };
  }
  const ttl = ttlParse.data;

  let verifier: string | null = null;
  if (obj.verifier !== undefined) {
    if (!isValidVerifier(obj.verifier)) {
      return { ok: false, status: 400, body: { error: "INVALID_VERIFIER" } };
    }
    verifier = obj.verifier;
  }

  let usesLeft: number | undefined;
  if (obj.usesLeft !== undefined) {
    if (!isValidUsesLeft(obj.usesLeft)) {
      return { ok: false, status: 400, body: { error: "INVALID_USES_LEFT" } };
    }
    usesLeft = obj.usesLeft;
  }

  let deletionTokenHash: string | undefined;
  if (obj.deletionTokenHash !== undefined) {
    if (!isValidDeletionTokenHash(obj.deletionTokenHash)) {
      return {
        ok: false,
        status: 400,
        body: { error: "INVALID_DELETION_TOKEN_HASH" },
      };
    }
    deletionTokenHash = obj.deletionTokenHash;
  }

  return {
    ok: true,
    input: { blob, ttl, verifier, usesLeft, deletionTokenHash },
  };
}

/**
 * Build the persisted LinkRecord from validated input. Pure: same inputs
 * always produce the same record. Branches on `verifier` for v1 vs v2 shape.
 */
export function buildLinkRecord(
  input: CreateInput,
  createdAt: string,
): LinkRecord {
  const { blob, ttl, verifier, usesLeft, deletionTokenHash } = input;
  return verifier
    ? {
        blob,
        ttl,
        createdAt,
        version: 2,
        verifier,
        attemptsLeft: MAX_PASSWORD_ATTEMPTS,
        ...(usesLeft !== undefined ? { usesLeft } : {}),
        ...(deletionTokenHash ? { deletionTokenHash } : {}),
      }
    : {
        blob,
        ttl,
        createdAt,
        version: 1,
        ...(usesLeft !== undefined ? { usesLeft } : {}),
        ...(deletionTokenHash ? { deletionTokenHash } : {}),
      };
}

/**
 * Best-effort increment of the global + per-origin daily-write counters.
 * Swallows errors — counter drift is acceptable; the link is already saved.
 */
async function tryIncrementBudgets(
  env: HonoEnv["Bindings"],
  globalCount: number,
  origin: string | null,
  originCount: number | null,
): Promise<void> {
  try {
    await incrementBudgetCounters(
      env,
      todayKey(),
      globalCount,
      origin,
      originCount,
    );
  } catch {
    // Counter increment failure is non-fatal — the link is already saved.
  }
}

/**
 * If the record is in a server-imposed backoff window, return the BACKOFF
 * response body + Retry-After header. Otherwise null.
 */
export function checkBackoffGate(
  record: LinkRecordV2,
  now: number,
):
  | null
  | {
      body: { error: string; attemptsLeft: number; retryAfterMs: number };
      headers: Record<string, string>;
    } {
  if (record.backoffUntil === undefined || record.backoffUntil <= now) {
    return null;
  }
  const retryAfterSec = Math.ceil((record.backoffUntil - now) / 1000);
  return {
    body: {
      error: "BACKOFF",
      attemptsLeft: record.attemptsLeft,
      retryAfterMs: record.backoffUntil - now,
    },
    headers: { "Retry-After": String(retryAfterSec) },
  };
}

/**
 * Match path: reset the attempts counter, decrement opt-in uses, destroy
 * the record if that brings uses to zero. Returns the blob on success or a
 * NOT_FOUND if a critical counter write fails (so we don't silently hand
 * out extra uses).
 */
async function handleMatch(
  c: Context<HonoEnv>,
  store: CloudflareKVLinkStore,
  id: string,
  record: LinkRecordV2,
): Promise<Response> {
  const needsAttemptsReset = record.attemptsLeft < MAX_PASSWORD_ATTEMPTS;
  const needsBackoffClear = record.backoffUntil !== undefined;
  const hasUsesCounter = record.usesLeft !== undefined;

  if (hasUsesCounter) {
    const remaining = (record.usesLeft as number) - 1;
    try {
      if (remaining <= 0) {
        await store.delete(id);
      } else {
        await store.update(
          id,
          refreshRecord(record, {
            attemptsLeft: MAX_PASSWORD_ATTEMPTS,
            usesLeft: remaining,
            clearBackoff: true,
          }),
          record.ttl,
        );
      }
    } catch {
      // Counter write failed — refuse the unlock rather than silently
      // hand out extra uses.
      return c.json({ error: "NOT_FOUND" }, 404);
    }
  } else if (needsAttemptsReset || needsBackoffClear) {
    try {
      await store.update(
        id,
        refreshRecord(record, {
          attemptsLeft: MAX_PASSWORD_ATTEMPTS,
          clearBackoff: true,
        }),
        record.ttl,
      );
    } catch {
      // Reset failure is non-fatal — next success will retry.
    }
  }
  return c.json({ blob: record.blob }, 200);
}

/**
 * Miss path: decrement attempts (or destroy on the last miss), set a
 * backoff window per the configured schedule, persist best-effort, and
 * return the typed 401/410 response body.
 */
async function handleMiss(
  c: Context<HonoEnv>,
  store: CloudflareKVLinkStore,
  id: string,
  record: LinkRecordV2,
  now: number,
): Promise<Response> {
  const remaining = record.attemptsLeft - 1;
  if (remaining <= 0) {
    try {
      await store.delete(id);
    } catch {
      // Counter is already at 0; the next miss will retry the deletion.
    }
    return c.json({ error: "LINK_DESTROYED" }, 410);
  }

  const backoffMs = PASSWORD_BACKOFF_MS_BY_ATTEMPTS_LEFT[remaining] ?? 0;
  const backoffUntil = backoffMs > 0 ? now + backoffMs : undefined;

  const decremented = refreshRecord(record, {
    attemptsLeft: remaining,
    ...(backoffUntil !== undefined
      ? { backoffUntil }
      : { clearBackoff: true }),
  });
  try {
    await store.update(id, decremented, record.ttl);
  } catch {
    // Best-effort persist. One free retry on failure is acceptable.
  }
  return c.json(
    {
      error: "WRONG_PASSWORD",
      attemptsLeft: remaining,
      ...(backoffMs > 0 ? { retryAfterMs: backoffMs } : {}),
    },
    401,
  );
}

// ─── Mount routes ─────────────────────────────────────────────────────────────

export function mountLinksRoutes(app: Hono<HonoEnv>): void {
  // POST /api/v1/links — create. Order: rate limit → daily budget → handler.
  app.post(
    "/api/v1/links",
    rateLimitMiddleware({
      tag: "links_post",
      windowMs: 15 * 60 * 1000, // 15 minutes
      limit: 20,
    }),
    dailyBudgetMiddleware(),
    async (c) => {
      const parsed = await parseJsonObject(c);
      if (!parsed.ok) return c.json({ error: "INVALID_BLOB" }, 400);

      const validated = parseCreateInput(parsed.obj);
      if (!validated.ok) return c.json(validated.body, validated.status);
      const { input } = validated;

      const store = new CloudflareKVLinkStore(c.env.VOIDHOP_KV);
      let id: string;
      try {
        id = await generateAndReserveId(store);
      } catch (e) {
        if (e instanceof IdCollisionError) {
          return c.json({ error: "STORAGE_ERROR" }, 503);
        }
        throw e;
      }

      const record = buildLinkRecord(input, new Date().toISOString());
      try {
        await store.put(id, record, input.ttl);
      } catch (e) {
        return c.json(
          { error: "STORAGE_ERROR" },
          e instanceof IdCollisionError ? 503 : 500,
        );
      }

      await tryIncrementBudgets(
        c.env,
        c.get("budgetGlobalCount") ?? 0,
        c.get("budgetOrigin") ?? null,
        c.get("budgetOriginCount") ?? null,
      );

      return c.json({ id }, 201);
    },
  );

  // GET /api/v1/links/:id — retrieve.
  app.get(
    "/api/v1/links/:id",
    rateLimitMiddleware({
      tag: "links_get",
      windowMs: 60 * 1000, // 1 minute
      limit: 60,
    }),
    async (c) => {
      const id = c.req.param("id");
      if (!isValidId(id)) {
        // Item 17: collapse 400 into 404 to defeat enumeration.
        return c.json({ error: "NOT_FOUND" }, 404);
      }
      const store = new CloudflareKVLinkStore(c.env.VOIDHOP_KV);
      const record = await store.get(id);
      if (record === null) {
        return c.json({ error: "NOT_FOUND" }, 404);
      }
      // V2 (password-protected): withhold the blob; client must POST to
      // /unlock with a valid verifier to receive it. Return the current
      // attemptsLeft and (if set) usesLeft so the UI shows the real
      // remaining counts instead of a stale client-side initial guess.
      if (record.version === 2) {
        return c.json(
          {
            protected: true,
            attemptsLeft: record.attemptsLeft,
            ...(record.usesLeft !== undefined
              ? { usesLeft: record.usesLeft }
              : {}),
          },
          200,
        );
      }
      // V1 (open read). If a multi-use counter is set, decrement it in KV
      // BEFORE returning the blob. Decrement-first means a lost KV write
      // may cost the user a retry but never hands out extra uses.
      if (record.usesLeft !== undefined) {
        const remaining = record.usesLeft - 1;
        try {
          if (remaining <= 0) {
            await store.delete(id);
          } else {
            await store.update(id, { ...record, usesLeft: remaining }, record.ttl);
          }
        } catch {
          // If the counter write failed, return NOT_FOUND rather than the
          // blob so we don't quietly hand out extra uses.
          return c.json({ error: "NOT_FOUND" }, 404);
        }
      }
      return c.json({ blob: record.blob }, 200);
    },
  );

  // HEAD /api/v1/links/:id — existence check.
  app.on(
    "HEAD",
    "/api/v1/links/:id",
    rateLimitMiddleware({
      tag: "links_head",
      windowMs: 60 * 1000,
      limit: 60,
    }),
    async (c) => {
      const id = c.req.param("id");
      if (!isValidId(id)) return new Response(null, { status: 404 });
      const store = new CloudflareKVLinkStore(c.env.VOIDHOP_KV);
      const exists = await store.exists(id);
      return new Response(null, { status: exists ? 200 : 404 });
    },
  );

  // POST /api/v1/links/:id/unlock — verifier check for v2 protected links.
  //
  // Success: returns { blob }. If attemptsLeft is below MAX, resets it to MAX.
  // Miss:    decrements attemptsLeft and returns 401 { error, attemptsLeft }.
  //          On the final miss (attemptsLeft was 1), deletes the record and
  //          returns 410 { error: "LINK_DESTROYED" }.
  //
  // Route is mounted flat on the parent app (matching the convention in the
  // header comment at the top of this file) so that sub-router base-path
  // matching ambiguity cannot cause a miss.
  app.post(
    "/api/v1/links/:id/unlock",
    rateLimitMiddleware({
      tag: "links_unlock",
      windowMs: 60 * 1000,
      limit: 20,
    }),
    async (c) => {
      const id = c.req.param("id");
      if (!isValidId(id)) return c.json({ error: "NOT_FOUND" }, 404);

      const parsed = await parseJsonObject(c);
      if (!parsed.ok) return c.json({ error: "INVALID_VERIFIER" }, 400);
      const submitted = parsed.obj.verifier;
      if (!isValidVerifier(submitted)) {
        return c.json({ error: "INVALID_VERIFIER" }, 400);
      }

      const store = new CloudflareKVLinkStore(c.env.VOIDHOP_KV);
      const record = await store.get(id);
      // Unlock only makes sense for v2. v1 at this endpoint is a client bug —
      // respond 404 so the attack surface stays uniform with "no such link".
      if (record === null || record.version !== 2) {
        return c.json({ error: "NOT_FOUND" }, 404);
      }

      const now = Date.now();
      const backoff = checkBackoffGate(record, now);
      if (backoff !== null) {
        return c.json(backoff.body, 429, backoff.headers);
      }

      if (constantTimeEqual(submitted, record.verifier)) {
        return handleMatch(c, store, id, record);
      }
      return handleMiss(c, store, id, record, now);
    },
  );

  // DELETE /api/v1/links/:id — creator-initiated destruction via token.
  //
  // Authorized if the submitted token, hashed with SHA-256 and base64url
  // encoded, matches the record's stored `deletionTokenHash`. Records
  // without a hash (v1.0 links or creator opted out) cannot be deleted
  // this way; they wait for the TTL to expire.
  app.delete(
    "/api/v1/links/:id",
    rateLimitMiddleware({
      tag: "links_delete",
      windowMs: 60 * 1000,
      limit: 10,
    }),
    async (c) => {
      const id = c.req.param("id");
      if (!isValidId(id)) return c.json({ error: "NOT_FOUND" }, 404);

      const parsed = await parseJsonObject(c);
      if (!parsed.ok) {
        return c.json({ error: "INVALID_DELETION_TOKEN" }, 400);
      }
      const submittedToken = parsed.obj.token;
      if (!isBase64UrlString(submittedToken, DELETION_TOKEN_B64URL_LENGTH)) {
        return c.json({ error: "INVALID_DELETION_TOKEN" }, 400);
      }

      const store = new CloudflareKVLinkStore(c.env.VOIDHOP_KV);
      const record = await store.get(id);
      if (record === null) {
        return c.json({ error: "NOT_FOUND" }, 404);
      }
      if (record.deletionTokenHash === undefined) {
        // No deletion token was registered — this link is not creator-deletable.
        // Collapse to 404 so we don't leak the distinction from "no such link".
        return c.json({ error: "NOT_FOUND" }, 404);
      }

      // Recompute SHA-256(submitted_token) and constant-time compare.
      const submittedHash = await sha256Base64Url(submittedToken);
      if (!constantTimeEqual(submittedHash, record.deletionTokenHash)) {
        // Wrong token. Return 404 to keep the attack surface uniform with
        // "no such record" — no brute-forcing acceleration from distinct
        // error codes.
        return c.json({ error: "NOT_FOUND" }, 404);
      }

      await store.delete(id);
      return new Response(null, { status: 204 });
    },
  );
}

/** Base64-url length of the raw deletion token — keep in sync with
 * `src/constants/index.ts:DELETION_TOKEN_B64URL_LENGTH`. */
const DELETION_TOKEN_B64URL_LENGTH = 43;

/** SHA-256 of a base64url string, returned base64url (43 chars). */
async function sha256Base64Url(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const out = new Uint8Array(digest);
  // Worker-local base64url encoder (no padding) — duplicates browser impl
  // rather than share code because the tsconfig trees are separate.
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let s = "";
  for (let i = 0; i < out.length; i += 3) {
    const b0 = out[i]!;
    const b1 = i + 1 < out.length ? out[i + 1]! : 0;
    const b2 = i + 2 < out.length ? out[i + 2]! : 0;
    s += alphabet[b0 >> 2]!;
    s += alphabet[((b0 & 0x03) << 4) | (b1 >> 4)]!;
    if (i + 1 < out.length) s += alphabet[((b1 & 0x0f) << 2) | (b2 >> 6)]!;
    if (i + 2 < out.length) s += alphabet[b2 & 0x3f]!;
  }
  return s;
}
