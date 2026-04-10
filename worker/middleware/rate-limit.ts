/**
 * IP-based rate limiting backed by Cloudflare KV. SRS §11.2.
 *
 * IPv4 sources are bucketed by full address; IPv6 sources are bucketed by
 * /64 prefix to defeat IPv6 rotation (item 3 / SR-INPUT-05).
 */

import type { MiddlewareHandler } from "hono";
import type { Env } from "../types";

export interface RateLimitConfig {
  /** Endpoint tag (used in the KV key) */
  readonly tag: string;
  /** Window length in milliseconds */
  readonly windowMs: number;
  /** Maximum requests per window per IP bucket */
  readonly limit: number;
}

export function rateLimitMiddleware(
  config: RateLimitConfig,
): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const ip = c.req.header("CF-Connecting-IP") ?? "unknown";
    const bucket = ipBucket(ip);
    const windowId = Math.floor(Date.now() / config.windowMs);
    const key = `rl:${config.tag}:${bucket}:${windowId}`;

    const currentRaw = await c.env.VOIDHOP_KV.get(key);
    const current = currentRaw ? parseInt(currentRaw, 10) : 0;

    if (current >= config.limit) {
      const retryAfter = Math.ceil(
        (config.windowMs - (Date.now() % config.windowMs)) / 1000,
      );
      return c.json(
        { error: "RATE_LIMITED" },
        429,
        { "Retry-After": String(retryAfter) },
      );
    }

    // Best-effort: KV has no atomic increment, but the per-IP race is bounded
    // by the limit itself, and the global cap is enforced separately.
    await c.env.VOIDHOP_KV.put(key, String(current + 1), {
      expirationTtl: Math.ceil((config.windowMs * 2) / 1000),
    });

    return next();
  };
}

/**
 * Compute the rate-limit bucket for a CF-Connecting-IP value.
 *  - IPv4: full address
 *  - IPv6: /64 prefix (first 4 hextets)
 *
 * Exported for unit testing.
 */
export function ipBucket(ip: string): string {
  if (ip.length === 0) return "unknown";

  // Quick IPv4 check: contains a dot but no colon.
  if (ip.includes(".") && !ip.includes(":")) {
    return `v4:${ip}`;
  }

  // IPv6: split on `:`. Handle the `::` zero-compression form.
  // We need exactly the first four hextets, expanded.
  const expanded = expandIpv6(ip);
  if (expanded === null) {
    // Not a recognizable IP — fall back to using the raw string verbatim.
    return `raw:${ip}`;
  }
  // First 4 hextets joined by `:`
  return `v6_64:${expanded.slice(0, 4).join(":")}`;
}

/**
 * Expand a (potentially `::`-compressed) IPv6 string into 8 hextet strings.
 * Returns null if the input is not a valid IPv6 address.
 *
 * Exported for testing.
 */
export function expandIpv6(ip: string): string[] | null {
  if (!ip.includes(":")) return null;

  // Strip an optional zone identifier (`%eth0`).
  const zoneIdx = ip.indexOf("%");
  const cleaned = zoneIdx >= 0 ? ip.slice(0, zoneIdx) : ip;

  const doubleColon = cleaned.indexOf("::");
  let head: string[];
  let tail: string[];

  if (doubleColon < 0) {
    head = cleaned.split(":");
    tail = [];
  } else {
    const headStr = cleaned.slice(0, doubleColon);
    const tailStr = cleaned.slice(doubleColon + 2);
    head = headStr.length > 0 ? headStr.split(":") : [];
    tail = tailStr.length > 0 ? tailStr.split(":") : [];
  }

  const fillCount = 8 - head.length - tail.length;
  if (fillCount < 0) return null;

  const result: string[] = [];
  for (const h of head) {
    if (!isValidHextet(h)) return null;
    result.push(h.toLowerCase().padStart(4, "0"));
  }
  for (let i = 0; i < fillCount; i++) result.push("0000");
  for (const t of tail) {
    if (!isValidHextet(t)) return null;
    result.push(t.toLowerCase().padStart(4, "0"));
  }
  return result.length === 8 ? result : null;
}

function isValidHextet(s: string): boolean {
  if (s.length === 0 || s.length > 4) return false;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    const ok =
      (c >= 48 && c <= 57) || // 0-9
      (c >= 65 && c <= 70) || // A-F
      (c >= 97 && c <= 102); // a-f
    if (!ok) return false;
  }
  return true;
}
