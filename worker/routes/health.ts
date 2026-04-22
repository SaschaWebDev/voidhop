/**
 * /api/v1/health — operator health check. SRS §6.4 / §9.2.
 *
 * Routes are registered FLAT on the parent Hono app to avoid sub-router
 * base-path matching ambiguity (see comment in worker/routes/links.ts).
 */

import type { Hono } from "hono";
import type { HonoEnv } from "../types";
import { rateLimitMiddleware } from "../middleware/rate-limit";
import { todayKey } from "../middleware/daily-budget";

const PER_ORIGIN_BUDGET_FRACTION: Readonly<Record<string, number>> = {
  "https://voidhop.com": 1.0,
  "https://notefade.com": 0.6,
};

export function mountHealthRoutes(app: Hono<HonoEnv>): void {
  app.get(
    "/api/v1/health",
    rateLimitMiddleware({
      tag: "health",
      windowMs: 60 * 1000,
      limit: 10,
    }),
    async (c) => {
      const date = todayKey();
      const globalLimit = parseInt(c.env.DAILY_WRITE_BUDGET, 10);

      const writesRaw = await c.env.VOIDHOP_KV.get(`__meta:writes:${date}`);
      const readsRaw = await c.env.VOIDHOP_KV.get(`__meta:reads:${date}`);
      const writes = writesRaw ? parseInt(writesRaw, 10) : 0;
      const reads = readsRaw ? parseInt(readsRaw, 10) : 0;

      const allowedOrigins = c.env.ALLOWED_ORIGINS.split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const writes_by_origin: Record<string, number> = {};
      const writes_remaining_by_origin: Record<string, number> = {};
      for (const origin of allowedOrigins) {
        const raw = await c.env.VOIDHOP_KV.get(
          `__meta:writes:${date}:${origin}`,
        );
        const count = raw ? parseInt(raw, 10) : 0;
        // Sub-quotas are opt-in; unmapped allowed origins get the full budget.
        const fraction = PER_ORIGIN_BUDGET_FRACTION[origin] ?? 1.0;
        const limit = Math.floor(globalLimit * fraction);
        writes_by_origin[origin] = count;
        writes_remaining_by_origin[origin] = Math.max(0, limit - count);
      }

      return c.json({
        status: "ok",
        writes_today: writes,
        writes_remaining: Math.max(0, globalLimit - writes),
        writes_by_origin,
        writes_remaining_by_origin,
        reads_today: reads,
        server_time_utc: new Date().toISOString(),
      });
    },
  );
}
