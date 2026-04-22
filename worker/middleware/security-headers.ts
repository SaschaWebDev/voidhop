/**
 * Security headers middleware. SRS §9.4 / §11.1 / SR-CACHE-01.
 *
 * Registered as the OUTERMOST `app.use("*", ...)` so it wraps every response,
 * including ones produced by `app.notFound` and `app.onError`. Per item 18,
 * no error response (404, 429, 500, 503) may ever be served from CDN cache.
 */

import type { MiddlewareHandler } from "hono";

// CSP kept in sync with `public/_headers` (the one that actually protects
// browsers loading the SPA from Cloudflare Pages). Browsers largely ignore
// most CSP directives on JSON responses, but this serves two purposes:
//   1. Defense in depth if someone later enables asset binding on the Worker
//      so it serves HTML too.
//   2. Any XHR that a compromised caller sent with an `Accept: text/html`
//      and got surprising data back would still be contained.
const CSP =
  "default-src 'self'; " +
  "script-src 'self'; " +
  "style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data:; " +
  "connect-src 'self'; " +
  "font-src 'self'; " +
  "object-src 'none'; " +
  "base-uri 'none'; " +
  "frame-ancestors 'none'; " +
  "form-action 'self'";

const HEADERS: ReadonlyArray<[string, string]> = [
  ["Cache-Control", "no-store, no-cache"],
  ["Referrer-Policy", "no-referrer"],
  ["X-Content-Type-Options", "nosniff"],
  ["X-Frame-Options", "DENY"],
  ["Content-Security-Policy", CSP],
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
