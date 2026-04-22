/**
 * CORS middleware. SRS §9.3.
 *
 * Strict origin allowlist parsed from the `ALLOWED_ORIGINS` env var. Origins
 * not in the list receive no CORS headers, which causes the browser to
 * reject the response.
 */

import type { MiddlewareHandler } from "hono";
import type { Env } from "../types";

export function corsMiddleware(): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const allowed = c.env.ALLOWED_ORIGINS.split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const origin = c.req.header("Origin");

    // Preflight short-circuit
    if (c.req.method === "OPTIONS") {
      if (origin && allowed.includes(origin)) {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "GET, POST, DELETE, HEAD, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Max-Age": "86400",
            Vary: "Origin",
          },
        });
      }
      // Reject unknown origins explicitly.
      return new Response(null, { status: 403 });
    }

    await next();

    if (origin && allowed.includes(origin)) {
      c.res.headers.set("Access-Control-Allow-Origin", origin);
      c.res.headers.set("Vary", "Origin");
    }
    return;
  };
}

/**
 * Returns the request's Origin header if it is in the allowlist, else null.
 * Used by the daily-budget middleware to attribute writes to the correct
 * per-origin counter.
 */
export function resolveAllowedOrigin(
  request: Request,
  allowedOriginsEnv: string,
): string | null {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  const allowed = allowedOriginsEnv
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return allowed.includes(origin) ? origin : null;
}
