/**
 * VoidHop Worker entry — Hono app. SRS §11.1.
 *
 * Middleware ordering is critical: `securityHeadersMiddleware` is registered
 * first so it wraps every response, including ones produced by `notFound`
 * and `onError` handlers. SR-CACHE-01.
 *
 * Routes are mounted FLAT on this app (not via `app.route()` sub-routers)
 * so that `POST /api/v1/links` matches both with and without a trailing
 * slash, and so that route registration is auditable in one place per file.
 */

import { Hono } from "hono";
import type { Env } from "./types";
import { securityHeadersMiddleware } from "./middleware/security-headers";
import { corsMiddleware } from "./middleware/cors";
import { mountLinksRoutes } from "./routes/links";
import { mountHealthRoutes } from "./routes/health";

const app = new Hono<{ Bindings: Env }>();

// 1. Security headers — outermost wrapper. Applies to ALL responses.
app.use("*", securityHeadersMiddleware);

// 2. CORS — origin allowlist + preflight handling.
app.use("/api/*", corsMiddleware());

// 3. Routes — mounted flat on the parent app.
mountLinksRoutes(app);
mountHealthRoutes(app);

// 4. Fallback handlers — security headers still wrap their responses
//    because they were registered AFTER the middleware above.
app.notFound((c) =>
  c.json(
    { error: "NOT_FOUND", path: c.req.path, method: c.req.method },
    404,
  ),
);

app.onError((err, c) => {
  // Log full request + error context to the wrangler dev console so the next
  // failure is debuggable without code-spelunking. Response body still hides
  // internal details from clients.
  const errName = err instanceof Error ? err.name : "UnknownError";
  const errMessage = err instanceof Error ? err.message : String(err);
  const errStack = err instanceof Error ? err.stack : undefined;
  console.error("[voidhop] unhandled error in handler");
  console.error("  request:", c.req.method, c.req.url);
  console.error("  error  :", errName, "—", errMessage);
  if (errStack) console.error(errStack);
  return c.json({ error: "SERVER_ERROR" }, 500);
});

export default app;
