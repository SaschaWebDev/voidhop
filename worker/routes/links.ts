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
import type { Env, LinkRecord } from "../types";
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

export function mountLinksRoutes(app: Hono<{ Bindings: Env }>): void {
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

      const record: LinkRecord = {
        blob,
        ttl,
        createdAt: new Date().toISOString(),
        version: 1,
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
        const globalCount = c.get("budgetGlobalCount") as number;
        const origin = c.get("budgetOrigin") as string | null;
        const originCount = c.get("budgetOriginCount") as number | null;
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

  // DELETE /api/v1/links/:id — operator/admin (no auth in v1.0; v1.2 adds HMAC-derived token).
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
      const store = new CloudflareKVLinkStore(c.env.VOIDHOP_KV);
      const existed = await store.delete(id);
      if (!existed) {
        return c.json({ error: "NOT_FOUND" }, 404);
      }
      return new Response(null, { status: 204 });
    },
  );
}
