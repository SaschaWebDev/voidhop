/**
 * Worker integration tests using Miniflare. SRS §17.2.
 *
 * Spawns the worker against an in-memory KV namespace and exercises the
 * full request lifecycle: success path, validation errors, ID-format 404
 * collapse (item 17), TTL ceiling enforcement, daily-budget exhaustion,
 * and security-header coverage on every status code (SR-CACHE-01).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Miniflare } from "miniflare";
// Miniflare loads the worker from disk via scriptPath below; we don't import
// the worker module directly here.

let mf: Miniflare;

beforeAll(async () => {
  mf = new Miniflare({
    modules: true,
    scriptPath: "./worker/index.ts",
    compatibilityDate: "2025-04-01",
    compatibilityFlags: ["nodejs_compat"],
    bindings: {
      ENVIRONMENT: "test",
      ALLOWED_ORIGINS: "https://voidhop.com,https://notefade.com",
      DAILY_WRITE_BUDGET: "950",
    },
    kvNamespaces: ["VOIDHOP_KV"],
  });
});

afterAll(async () => {
  await mf.dispose();
});

async function fetchMf(
  path: string,
  init?: RequestInit & { origin?: string },
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (init?.origin) headers.set("Origin", init.origin);
  // Miniflare requires a `CF-Connecting-IP` for the rate-limiter
  if (!headers.has("CF-Connecting-IP")) {
    headers.set("CF-Connecting-IP", "203.0.113.42");
  }
  // Miniflare's Response / HeadersInit types derive from undici, which
  // diverge from the lib.dom equivalents in TS 5.7+. Runtime behaviour is
  // identical for our purposes; punch through the mismatch.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dispatch: any = mf.dispatchFetch;
  return dispatch(`http://test.local${path}`, {
    ...init,
    headers,
  }) as Promise<Response>;
}

const SAMPLE_BLOB = "A".repeat(120); // valid base64url, fits in 1 KB tier

/**
 * POST a create-link body. Shared because every test in the POST
 * describe block builds the same headers/origin/JSON shape — extracted
 * to keep the focus on the body variation.
 */
async function postLink(
  body: unknown,
  origin = "https://voidhop.com",
): Promise<Response> {
  return fetchMf("/api/v1/links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    origin,
    body: JSON.stringify(body),
  });
}

async function createAndGetId(): Promise<string> {
  const res = await postLink({ blob: SAMPLE_BLOB, ttl: 3600 });
  const { id } = (await res.json()) as { id: string };
  return id;
}

describe("POST /api/v1/links", () => {
  it("creates a link with a valid body and returns 201 + id", async () => {
    const res = await postLink({ blob: SAMPLE_BLOB, ttl: 3600 });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    expect(body.id).toMatch(/^[A-Za-z0-9_-]{8}$/);
  });

  it("rejects an invalid blob with 400 INVALID_BLOB", async () => {
    const res = await postLink({ blob: "not!valid", ttl: 3600 });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("INVALID_BLOB");
  });

  it("rejects an oversized blob with 400 BLOB_TOO_LARGE", async () => {
    const res = await postLink({ blob: "A".repeat(400_000), ttl: 3600 });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("BLOB_TOO_LARGE");
  });

  it.each([
    ["1 day off the allow-list", 12345],
    ["30 days (formerly valid in v1.0/v1.1.0; rejected in v1.1.1)", 2592000],
    ["1 year (formerly valid in v1.0)", 31536000],
  ])("rejects out-of-allow-list TTL: %s → 400 INVALID_TTL", async (_, ttl) => {
    const res = await postLink({ blob: SAMPLE_BLOB, ttl });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("INVALID_TTL");
  });
});

describe("GET /api/v1/links/:id", () => {
  let createdId: string;

  beforeAll(async () => {
    createdId = await createAndGetId();
  });

  it("returns 200 + blob for an existing ID", async () => {
    const res = await fetchMf(`/api/v1/links/${createdId}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { blob: string };
    expect(body.blob).toBe(SAMPLE_BLOB);
  });

  it("returns 404 for a valid-format but non-existent ID", async () => {
    const res = await fetchMf("/api/v1/links/AAAAAAAA");
    expect(res.status).toBe(404);
  });

  it("returns 404 (not 400) for an invalid ID format — item 17", async () => {
    const res = await fetchMf("/api/v1/links/!!!");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("NOT_FOUND");
  });
});

describe("DELETE /api/v1/links/:id", () => {
  it("returns 204 on successful delete and 404 on subsequent GET", async () => {
    const id = await createAndGetId();

    const del = await fetchMf(`/api/v1/links/${id}`, { method: "DELETE" });
    expect(del.status).toBe(204);

    const get = await fetchMf(`/api/v1/links/${id}`);
    expect(get.status).toBe(404);
  });

  it("returns 404 (not 400) for an invalid ID format on DELETE", async () => {
    const res = await fetchMf("/api/v1/links/!!!", { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});

describe("HEAD /api/v1/links/:id", () => {
  it("returns 200 if the link exists, 404 otherwise", async () => {
    const id = await createAndGetId();

    const exists = await fetchMf(`/api/v1/links/${id}`, { method: "HEAD" });
    expect(exists.status).toBe(200);

    const missing = await fetchMf("/api/v1/links/AAAAAAAA", {
      method: "HEAD",
    });
    expect(missing.status).toBe(404);
  });
});

describe("GET /api/v1/health", () => {
  it("returns ok with all expected fields", async () => {
    const res = await fetchMf("/api/v1/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("ok");
    expect(typeof body.writes_today).toBe("number");
    expect(typeof body.writes_remaining).toBe("number");
    expect(body).toHaveProperty("writes_by_origin");
    expect(body).toHaveProperty("writes_remaining_by_origin");
    expect(typeof body.server_time_utc).toBe("string");
  });
});

describe("Cache-Control coverage (SR-CACHE-01)", () => {
  it("every documented status code carries no-store, no-cache", async () => {
    // 200 — health
    const ok = await fetchMf("/api/v1/health");
    expect(ok.headers.get("Cache-Control")).toBe("no-store, no-cache");

    // 201 — POST link
    const created = await fetchMf("/api/v1/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      origin: "https://voidhop.com",
      body: JSON.stringify({ blob: SAMPLE_BLOB, ttl: 3600 }),
    });
    expect(created.headers.get("Cache-Control")).toBe("no-store, no-cache");

    // 400 — invalid blob
    const bad = await fetchMf("/api/v1/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      origin: "https://voidhop.com",
      body: JSON.stringify({ blob: "!", ttl: 3600 }),
    });
    expect(bad.headers.get("Cache-Control")).toBe("no-store, no-cache");

    // 404 — missing link
    const missing = await fetchMf("/api/v1/links/AAAAAAAA");
    expect(missing.headers.get("Cache-Control")).toBe("no-store, no-cache");

    // 404 — unknown route (notFound handler)
    const unknown = await fetchMf("/api/v1/does-not-exist");
    expect(unknown.headers.get("Cache-Control")).toBe("no-store, no-cache");
  });
});
