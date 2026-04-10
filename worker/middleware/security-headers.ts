/**
 * Security headers middleware. SRS §9.4 / §11.1 / SR-CACHE-01.
 *
 * Registered as the OUTERMOST `app.use("*", ...)` so it wraps every response,
 * including ones produced by `app.notFound` and `app.onError`. Per item 18,
 * no error response (404, 429, 500, 503) may ever be served from CDN cache.
 */

import type { MiddlewareHandler } from "hono";

const HEADERS: ReadonlyArray<[string, string]> = [
  ["Cache-Control", "no-store, no-cache"],
  ["Referrer-Policy", "no-referrer"],
  ["X-Content-Type-Options", "nosniff"],
  ["X-Frame-Options", "DENY"],
  [
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'",
  ],
  ["Permissions-Policy", "interest-cohort=()"],
  [
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload",
  ],
];

export const securityHeadersMiddleware: MiddlewareHandler = async (c, next) => {
  await next();
  for (const [name, value] of HEADERS) {
    // Use `set` so route handlers cannot accidentally override these headers.
    c.res.headers.set(name, value);
  }
};
