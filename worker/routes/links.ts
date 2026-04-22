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

import type { Hono } from "hono";
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

function isValidId(id: string): boolean {
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
function isBase64UrlString(s: unknown, expectedLength: number): s is string {
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

function isValidVerifier(s: unknown): s is string {
  return isBase64UrlString(s, VERIFIER_B64URL_LENGTH);
}

function isValidDeletionTokenHash(s: unknown): s is string {
  return isBase64UrlString(s, DELETION_TOKEN_HASH_B64URL_LENGTH);
}

/**
 * Validate an opt-in uses-left counter. Must be a positive integer within the
 * auditable ceiling.
 */
function isValidUsesLeft(n: unknown): n is number {
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
function constantTimeEqual(a: string, b: string): boolean {
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
function refreshRecord(
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
function validateBlob(blob: unknown):
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
      let body: unknown;
      try {
        body = await c.req.json();
      } catch {
        return c.json({ error: "INVALID_BLOB" }, 400);
      }

      if (typeof body !== "object" || body === null) {
        return c.json({ error: "INVALID_BLOB" }, 400);
      }
      const obj = body as Record<string, unknown>;

      // 1. Inline blob fast path — no regex, no Zod
      const blobCheck = validateBlob(obj.blob);
      if (!blobCheck.ok) {
        return c.json(blobCheck.body, blobCheck.status);
      }
      const blob = obj.blob as string;

      // 2. Zod for the small ttl field. The allowed-values list enforces
      //    the universal 7-day max — no separate ceiling check needed.
      const ttlParse = ttlSchema.safeParse(obj.ttl);
      if (!ttlParse.success) {
        return c.json({ error: "INVALID_TTL" }, 400);
      }
      const ttl = ttlParse.data;

      // 2b. Optional verifier for password-protected links (v2). When
      //     present, the record is stored as V2 with attemptsLeft=5.
      let verifier: string | null = null;
      if (obj.verifier !== undefined) {
        if (!isValidVerifier(obj.verifier)) {
          return c.json({ error: "INVALID_VERIFIER" }, 400);
        }
        verifier = obj.verifier;
      }

      // 2c. Optional usesLeft for multi-use counter. Opt-in; adds per-read
      //     KV writes (so a privacy-aware user may prefer to leave it off).
      let usesLeft: number | undefined;
      if (obj.usesLeft !== undefined) {
        if (!isValidUsesLeft(obj.usesLeft)) {
          return c.json({ error: "INVALID_USES_LEFT" }, 400);
        }
        usesLeft = obj.usesLeft;
      }

      // 2d. Optional deletionTokenHash — SHA-256(random 256-bit token) that
      //     the creator keeps in the delete URL. Server never sees the raw
      //     token; stores only the hash for constant-time comparison.
      let deletionTokenHash: string | undefined;
      if (obj.deletionTokenHash !== undefined) {
        if (!isValidDeletionTokenHash(obj.deletionTokenHash)) {
          return c.json({ error: "INVALID_DELETION_TOKEN_HASH" }, 400);
        }
        deletionTokenHash = obj.deletionTokenHash;
      }

      // 3. Allocate ID and persist.
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

      const createdAt = new Date().toISOString();
      const record: LinkRecord = verifier
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

      try {
        await store.put(id, record, ttl);
      } catch (e) {
        if (e instanceof IdCollisionError) {
          // Extremely unlikely race after the existence check.
          return c.json({ error: "STORAGE_ERROR" }, 503);
        }
        return c.json({ error: "STORAGE_ERROR" }, 500);
      }

      // 4. Increment budget counters (best-effort).
      try {
        const date = todayKey();
        const globalCount = c.get("budgetGlobalCount") ?? 0;
        const origin = c.get("budgetOrigin") ?? null;
        const originCount = c.get("budgetOriginCount") ?? null;
        await incrementBudgetCounters(
          c.env,
          date,
          globalCount,
          origin,
          originCount,
        );
      } catch {
        // Counter increment failure is non-fatal — the link is already saved.
      }

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
      if (!isValidId(id)) {
        return c.json({ error: "NOT_FOUND" }, 404);
      }

      let body: unknown;
      try {
        body = await c.req.json();
      } catch {
        return c.json({ error: "INVALID_VERIFIER" }, 400);
      }
      if (typeof body !== "object" || body === null) {
        return c.json({ error: "INVALID_VERIFIER" }, 400);
      }
      const submitted = (body as Record<string, unknown>).verifier;
      if (!isValidVerifier(submitted)) {
        return c.json({ error: "INVALID_VERIFIER" }, 400);
      }

      const store = new CloudflareKVLinkStore(c.env.VOIDHOP_KV);
      const record = await store.get(id);
      if (record === null) {
        return c.json({ error: "NOT_FOUND" }, 404);
      }
      // Unlocking only makes sense for v2. A v1 record at this endpoint is a
      // client bug — respond 404 to collapse with the "no such protected
      // link" case and keep the attack surface uniform.
      if (record.version !== 2) {
        return c.json({ error: "NOT_FOUND" }, 404);
      }

      // Exponential backoff gate. If a prior miss set `backoffUntil` in the
      // future, refuse to evaluate the verifier and return 429. The wait
      // prevents a fast-typing attacker from burning through all attempts
      // in a second while a legitimate typo costs 1–120s.
      const now = Date.now();
      if (record.backoffUntil !== undefined && record.backoffUntil > now) {
        const retryAfterSec = Math.ceil((record.backoffUntil - now) / 1000);
        return c.json(
          {
            error: "BACKOFF",
            attemptsLeft: record.attemptsLeft,
            retryAfterMs: record.backoffUntil - now,
          },
          429,
          { "Retry-After": String(retryAfterSec) },
        );
      }

      if (constantTimeEqual(submitted, record.verifier)) {
        // Match — return the blob. Before handing it out, apply side
        // effects: reset the attempts counter, decrement the optional
        // uses counter, destroy the record if that brings uses to zero.
        const needsAttemptsReset =
          record.attemptsLeft < MAX_PASSWORD_ATTEMPTS;
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
            // handing out extra uses. The attempts counter stays as-is.
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

      // Miss — either decrement and persist, or destroy on final miss.
      const remaining = record.attemptsLeft - 1;
      if (remaining <= 0) {
        try {
          await store.delete(id);
        } catch {
          // If delete fails, the next miss will retry the deletion path. Not
          // a privacy issue since the counter is already at 0.
        }
        return c.json({ error: "LINK_DESTROYED" }, 410);
      }

      // Set a backoff window before the next attempt is permitted. Index by
      // remaining attempts: fewer attempts left → longer mandatory wait.
      const backoffMs =
        PASSWORD_BACKOFF_MS_BY_ATTEMPTS_LEFT[remaining] ?? 0;
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
        // Best-effort persist. If this fails the attacker gets one free
        // retry — acceptable vs. the complexity of strong durability here.
      }
      return c.json(
        {
          error: "WRONG_PASSWORD",
          attemptsLeft: remaining,
          ...(backoffMs > 0 ? { retryAfterMs: backoffMs } : {}),
        },
        401,
      );
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
      if (!isValidId(id)) {
        return c.json({ error: "NOT_FOUND" }, 404);
      }

      let body: unknown;
      try {
        body = await c.req.json();
      } catch {
        return c.json({ error: "INVALID_DELETION_TOKEN" }, 400);
      }
      if (typeof body !== "object" || body === null) {
        return c.json({ error: "INVALID_DELETION_TOKEN" }, 400);
      }
      const submittedToken = (body as Record<string, unknown>).token;
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
