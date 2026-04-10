/**
 * Daily write budget middleware. SRS §11.3.
 *
 * Enforces both a global daily budget and per-origin sub-quotas (item 20).
 * Best-effort, not transactional — KV has no atomic increment, so under
 * burst load the counter may overshoot by up to ~50 entries. The 50-entry
 * buffer below the 1k/day KV ceiling absorbs this race. Hard cap is the
 * Cloudflare network-edge rate-limit rule from §6.2.
 */

import type { MiddlewareHandler } from "hono";
import type { Env } from "../types";
import { resolveAllowedOrigin } from "./cors";

const PER_ORIGIN_BUDGET_FRACTION: Readonly<Record<string, number>> = {
  "https://voidhop.com": 1.0,
  "https://notefade.com": 0.6,
};

const COUNTER_TTL_SECONDS = 172800; // 48 hours — auto-cleanup of old day counters

export interface BudgetReadResult {
  globalCount: number;
  originCount: number;
  origin: string | null;
  globalLimit: number;
  originLimit: number;
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export function secondsUntilUtcMidnight(): number {
  const now = new Date();
  const tomorrow = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      0,
      0,
    ),
  );
  return Math.ceil((tomorrow.getTime() - now.getTime()) / 1000);
}

export function dailyBudgetMiddleware(): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const date = todayKey();
    const globalLimit = parseInt(c.env.DAILY_WRITE_BUDGET, 10);
    const origin = resolveAllowedOrigin(c.req.raw, c.env.ALLOWED_ORIGINS);

    // Read the global counter.
    const globalRaw = await c.env.VOIDHOP_KV.get(`__meta:writes:${date}`);
    const globalCount = globalRaw ? parseInt(globalRaw, 10) : 0;

    if (globalCount >= globalLimit) {
      return c.json(
        { error: "DAILY_BUDGET_EXHAUSTED" },
        503,
        { "Retry-After": String(secondsUntilUtcMidnight()) },
      );
    }

    // Read the per-origin counter (only if we have an attributable origin).
    if (origin) {
      // Sub-quotas are opt-in containment, not default-deny. An allowed
      // origin without a fraction entry gets the full global budget so a
      // forgotten config edit doesn't silently 503 every request.
      const fraction = PER_ORIGIN_BUDGET_FRACTION[origin] ?? 1.0;
      const originLimit = Math.floor(globalLimit * fraction);
      const originRaw = await c.env.VOIDHOP_KV.get(
        `__meta:writes:${date}:${origin}`,
      );
      const originCount = originRaw ? parseInt(originRaw, 10) : 0;

      if (originCount >= originLimit) {
        return c.json(
          { error: "ORIGIN_BUDGET_EXHAUSTED" },
          503,
          { "Retry-After": String(secondsUntilUtcMidnight()) },
        );
      }

      // Stash counters on the context so the route handler can increment
      // them after a successful KV.put.
      c.set("budgetGlobalCount", globalCount);
      c.set("budgetOriginCount", originCount);
      c.set("budgetOrigin", origin);
    } else {
      c.set("budgetGlobalCount", globalCount);
      c.set("budgetOriginCount", null);
      c.set("budgetOrigin", null);
    }

    return next();
  };
}

/**
 * Increment the global and (if attributable) per-origin counters after a
 * successful link write. Read-modify-write; tolerates the race.
 */
export async function incrementBudgetCounters(
  env: Env,
  date: string,
  globalCountBefore: number,
  origin: string | null,
  originCountBefore: number | null,
): Promise<void> {
  await env.VOIDHOP_KV.put(
    `__meta:writes:${date}`,
    String(globalCountBefore + 1),
    { expirationTtl: COUNTER_TTL_SECONDS },
  );
  if (origin && originCountBefore !== null) {
    await env.VOIDHOP_KV.put(
      `__meta:writes:${date}:${origin}`,
      String(originCountBefore + 1),
      { expirationTtl: COUNTER_TTL_SECONDS },
    );
  }
}
