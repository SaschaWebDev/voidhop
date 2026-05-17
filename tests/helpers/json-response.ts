/**
 * Build a JSON `Response` with sensible defaults. Used by the api/client
 * fetch-mock tests to stub `globalThis.fetch` reply shapes.
 */

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}
